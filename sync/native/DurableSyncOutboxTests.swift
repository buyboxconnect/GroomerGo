import Foundation
import SwiftData
import Testing
@testable import GroomerGo

@MainActor struct DurableSyncOutboxTests {
    private func container() throws -> ModelContainer {
        let schema = Schema([BusinessProfile.self, GroomingService.self, Client.self, Pet.self, Appointment.self, SyncOutboxItem.self, SyncRecordCheckpoint.self])
        let container = try ModelContainer(for: schema, configurations: ModelConfiguration(schema: schema, isStoredInMemoryOnly: true))
        container.mainContext.autosaveEnabled = false
        return container
    }
    private func receipt(_ data: Data, revision: Int? = nil) throws -> MutationAcknowledgment {
        let mutation = try JSONDecoder().decode(RecordMutation.self, from: data)
        return MutationAcknowledgment(status: "applied", operationId: mutation.operationId, record: ServerRecord(businessId: mutation.businessId, recordUUID: mutation.recordUUID, recordType: mutation.recordType, revision: revision ?? mutation.baseRevision + 1, payloadJSON: mutation.payloadJSON))
    }
    @Test("Four linked record types commit stable scoped operations, unchanged saves do not duplicate them")
    func captureAndDelete() throws {
        let container = try container(), context = container.mainContext, business = UUID()
        let profile = BusinessProfile(); profile.businessId = business; profile.assignedByUserId = "owner"; context.insert(profile)
        let service = GroomingService(name: "Test groom", durationMinutes: 60, priceMinor: 1000, businessId: business)
        let client = Client(name: "Test client", businessId: business)
        let pet = Pet(name: "Test pet", client: client); client.pets.append(pet)
        let appointment = Appointment(scheduledAt: .now, service: service, client: client, pet: pet)
        context.insert(service); context.insert(client); context.insert(pet); context.insert(appointment)
        try LocalOutboxCapture.save(in: context)
        let items = try context.fetch(FetchDescriptor<SyncOutboxItem>())
        #expect(items.count == 4); #expect(Set(items.map(\.recordType)) == Set(["service", "client", "pet", "appointment"]))
        #expect(items.allSatisfy { $0.businessId == business && $0.ownerUserId == "owner" })
        let operationIds = Set(items.map(\.operationId)); try LocalOutboxCapture.save(in: context)
        #expect(Set(try context.fetch(FetchDescriptor<SyncOutboxItem>()).map(\.operationId)) == operationIds)
        context.delete(appointment); try LocalOutboxCapture.save(in: context)
        let deletion = try context.fetch(FetchDescriptor<SyncOutboxItem>()).filter { $0.action == "delete" }
        #expect(deletion.count == 1); #expect(deletion.first?.payloadJSON == "{}")
    }
    @Test("Retry freezes request bytes, preserves backoff, and rejects a different account before networking")
    func retryAndAccountBoundary() async throws {
        let container = try container(), context = container.mainContext
        let item = try #require(try DurableSyncOutbox.enqueue(in: context, businessId: UUID(), recordUUID: UUID(), ownerUserId: "owner", recordType: "client", payloadJSON: "{}"))
        var sent = 0, original = Data()
        do { try await DurableSyncOutbox.send(item, in: context, authenticatedUserId: "other") { _ in sent += 1; throw URLError(.timedOut) }; Issue.record("Different account was accepted") } catch {}
        #expect(sent == 0); #expect(item.attempts == 0)
        do { try await DurableSyncOutbox.send(item, in: context, authenticatedUserId: "owner") { data in sent += 1; original = data; throw URLError(.networkConnectionLost) } } catch {}
        #expect(item.state == "pending"); #expect(item.attempts == 1)
        let deadline = item.nextAttemptAt
        // Simulate process death after durable sending state, then reopen recovery.
        item.state = "sending"; try context.save(); try DurableSyncOutbox.recover(in: context)
        #expect(item.state == "pending"); #expect(item.nextAttemptAt == deadline)
        do { try await DurableSyncOutbox.send(item, in: context, authenticatedUserId: "owner", now: deadline.addingTimeInterval(-1)) { _ in sent += 1; throw URLError(.timedOut) }; Issue.record("Backoff ignored") } catch {}
        #expect(sent == 1)
        try await DurableSyncOutbox.send(item, in: context, authenticatedUserId: "owner", now: deadline) { data in #expect(data == original); return try receipt(data) }
        #expect(item.state == "acknowledged"); #expect(item.attempts == 2)
    }
    @Test("Offline edits serialize per UUID and freeze the next revision only after prior acknowledgment")
    func serialRevisions() async throws {
        let container = try container(), context = container.mainContext, business = UUID(), id = UUID()
        let first = try #require(try DurableSyncOutbox.enqueue(in: context, businessId: business, recordUUID: id, ownerUserId: "owner", recordType: "service", payloadJSON: "{\"name\":\"one\"}"))
        let second = try #require(try DurableSyncOutbox.enqueue(in: context, businessId: business, recordUUID: id, ownerUserId: "owner", recordType: "service", payloadJSON: "{\"name\":\"two\"}"))
        var sent = false
        do { try await DurableSyncOutbox.send(second, in: context, authenticatedUserId: "owner") { data in sent = true; return try receipt(data) }; Issue.record("Second edit overtook first") } catch {}
        #expect(!sent); #expect(second.requestJSON == nil)
        try await DurableSyncOutbox.send(first, in: context, authenticatedUserId: "owner") { try receipt($0) }
        try await DurableSyncOutbox.send(second, in: context, authenticatedUserId: "owner") { data in
            #expect(try JSONDecoder().decode(RecordMutation.self, from: data).baseRevision == 1)
            return try receipt(data)
        }
        #expect(second.acknowledgedRevision == 2)
    }
    @Test("Invalid receipts block the queue; conflicts persist instead of being acknowledged or retried")
    func invalidReceiptsAndConflicts() async throws {
        let container = try container(), context = container.mainContext
        let item = try #require(try DurableSyncOutbox.enqueue(in: context, businessId: UUID(), recordUUID: UUID(), ownerUserId: "owner", recordType: "pet", payloadJSON: "{}"))
        do { try await DurableSyncOutbox.send(item, in: context, authenticatedUserId: "owner") { try receipt($0, revision: 999) }; Issue.record("Invalid revision accepted") } catch {}
        #expect(item.state == "blocked"); #expect(item.acknowledgedRevision == nil)
        let conflict = try #require(try DurableSyncOutbox.enqueue(in: context, businessId: UUID(), recordUUID: UUID(), ownerUserId: "owner", recordType: "appointment", payloadJSON: "{}"))
        do { try await DurableSyncOutbox.send(conflict, in: context, authenticatedUserId: "owner") { _ in throw DurableSyncError.conflict } } catch {}
        try DurableSyncOutbox.recover(in: context)
        #expect(conflict.state == "conflict"); #expect(conflict.acknowledgedRevision == nil)
    }
}
