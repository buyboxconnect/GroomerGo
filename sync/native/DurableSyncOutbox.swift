import Foundation
import SwiftData

@Model final class SyncOutboxItem {
    var operationId: UUID
    var businessId: UUID
    var recordUUID: UUID
    var ownerUserId: String
    var recordType: String
    var action: String
    var payloadJSON: String
    var sequence: Int = 0
    var createdAt: Date
    var state: String
    var attempts: Int
    var nextAttemptAt: Date
    var requestJSON: String?
    var lastErrorCode: String?
    var acknowledgedRevision: Int?

    init(businessId: UUID, recordUUID: UUID, ownerUserId: String, recordType: String, action: String = "put", payloadJSON: String) {
        operationId = UUID(); self.businessId = businessId; self.recordUUID = recordUUID
        self.ownerUserId = ownerUserId; self.recordType = recordType; self.action = action
        self.payloadJSON = payloadJSON; createdAt = .now; state = "pending"; attempts = 0
        nextAttemptAt = .distantPast
    }
}

@Model final class SyncRecordCheckpoint {
    var businessId: UUID
    var recordUUID: UUID
    var ownerUserId: String
    var recordType: String
    var serverRevision: Int
    var stagedPayload: String
    var stagedAction: String
    init(businessId: UUID, recordUUID: UUID, ownerUserId: String, recordType: String) {
        self.businessId = businessId; self.recordUUID = recordUUID; self.ownerUserId = ownerUserId
        self.recordType = recordType; serverRevision = 0; stagedPayload = ""; stagedAction = ""
    }
}

struct RecordMutation: Codable, Sendable {
    let schemaVersion: Int
    let businessId: String
    let recordUUID: String
    let recordType: String
    let operationId: String
    let baseRevision: Int
    let action: String
    let payloadJSON: String
}
struct ServerRecord: Codable, Sendable {
    let businessId: String
    let recordUUID: String
    let recordType: String
    let revision: Int
    let payloadJSON: String
}
struct MutationAcknowledgment: Codable, Sendable {
    let status: String
    let operationId: String
    let record: ServerRecord
}
enum DurableSyncError: Error { case invalidIdentity, duplicateIdentity, invalidReceipt, outOfOrder, conflict, deferred, unauthenticated }

// Transport is injected. No production transport is enabled by this foundation.
@MainActor enum DurableSyncOutbox {
    static func checkpoint(in context: ModelContext, businessId: UUID, recordUUID: UUID, ownerUserId: String, recordType: String) throws -> SyncRecordCheckpoint {
        let matches = try context.fetch(FetchDescriptor<SyncRecordCheckpoint>()).filter { $0.businessId == businessId && $0.recordUUID == recordUUID }
        guard matches.count <= 1 else { throw DurableSyncError.duplicateIdentity }
        if let existing = matches.first {
            guard existing.ownerUserId == ownerUserId, existing.recordType == recordType else { throw DurableSyncError.invalidIdentity }
            return existing
        }
        let checkpoint = SyncRecordCheckpoint(businessId: businessId, recordUUID: recordUUID, ownerUserId: ownerUserId, recordType: recordType)
        context.insert(checkpoint); return checkpoint
    }

    // Caller edits its domain record in this same context. One save commits both.
    @discardableResult static func enqueue(in context: ModelContext, businessId: UUID, recordUUID: UUID, ownerUserId: String, recordType: String, action: String = "put", payloadJSON: String, save: Bool = true) throws -> SyncOutboxItem? {
        guard !ownerUserId.isEmpty, ["service", "client", "pet", "appointment"].contains(recordType), ["put", "delete"].contains(action), action != "delete" || payloadJSON == "{}" else { throw DurableSyncError.invalidIdentity }
        let point = try checkpoint(in: context, businessId: businessId, recordUUID: recordUUID, ownerUserId: ownerUserId, recordType: recordType)
        if point.stagedPayload == payloadJSON, point.stagedAction == action { if save { try context.save() }; return nil }
        let item = SyncOutboxItem(businessId: businessId, recordUUID: recordUUID, ownerUserId: ownerUserId, recordType: recordType, action: action, payloadJSON: payloadJSON)
        let existing = try context.fetch(FetchDescriptor<SyncOutboxItem>())
        item.sequence = (existing.map(\.sequence).max() ?? 0) + 1
        context.insert(item); point.stagedPayload = payloadJSON; point.stagedAction = action
        if save { try context.save() }
        return item
    }

    static func recover(in context: ModelContext) throws {
        for item in try context.fetch(FetchDescriptor<SyncOutboxItem>()) where item.state == "sending" {
            item.state = "pending" // Preserve the exact request and backoff deadline.
        }
        try context.save()
    }

    static func send(_ item: SyncOutboxItem, in context: ModelContext, authenticatedUserId: String, now: Date = .now, transport: (Data) async throws -> MutationAcknowledgment) async throws {
        guard item.ownerUserId == authenticatedUserId else { throw DurableSyncError.unauthenticated }
        guard item.state == "pending", item.nextAttemptAt <= now else { throw DurableSyncError.deferred }
        let earlier = try context.fetch(FetchDescriptor<SyncOutboxItem>()).contains { $0.businessId == item.businessId && $0.recordUUID == item.recordUUID && $0.operationId != item.operationId && $0.state != "acknowledged" && $0.sequence < item.sequence }
        guard !earlier else { throw DurableSyncError.outOfOrder }
        let point = try checkpoint(in: context, businessId: item.businessId, recordUUID: item.recordUUID, ownerUserId: item.ownerUserId, recordType: item.recordType)
        if item.requestJSON == nil {
            let mutation = RecordMutation(schemaVersion: 1, businessId: item.businessId.uuidString.lowercased(), recordUUID: item.recordUUID.uuidString.lowercased(), recordType: item.recordType, operationId: item.operationId.uuidString.lowercased(), baseRevision: point.serverRevision, action: item.action, payloadJSON: item.payloadJSON)
            let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
            item.requestJSON = String(decoding: try encoder.encode(mutation), as: UTF8.self)
        }
        // Durable write BEFORE any network call. Retrying never recomputes IDs/bytes.
        item.state = "sending"; item.attempts += 1; try context.save()
        do {
            let acknowledgment = try await transport(Data(item.requestJSON!.utf8))
            let record = acknowledgment.record
            let request = try JSONDecoder().decode(RecordMutation.self, from: Data(item.requestJSON!.utf8))
            guard ["applied", "replayed"].contains(acknowledgment.status), acknowledgment.operationId == request.operationId,
                  record.businessId == request.businessId, record.recordUUID == request.recordUUID,
                  record.recordType == request.recordType, record.revision == request.baseRevision + 1,
                  record.payloadJSON == request.payloadJSON else { throw DurableSyncError.invalidReceipt }
            point.serverRevision = max(point.serverRevision, record.revision)
            item.acknowledgedRevision = record.revision; item.state = "acknowledged"
            item.lastErrorCode = nil; try context.save()
        } catch {
            if case DurableSyncError.conflict = error { item.state = "conflict"; item.lastErrorCode = "REVISION_CONFLICT" }
            else if case DurableSyncError.invalidReceipt = error { item.state = "blocked"; item.lastErrorCode = "INVALID_RECEIPT" }
            else { item.state = "pending"; item.lastErrorCode = "RETRY_REQUIRED"; item.nextAttemptAt = now.addingTimeInterval(min(300, pow(2, Double(min(item.attempts, 8))))) }
            try context.save(); throw error
        }
    }
}
