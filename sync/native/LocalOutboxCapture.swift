import Foundation
import SwiftData

@MainActor enum LocalOutboxCapture {
    // Local changes and their pending operations commit together. No networking.
    static func save(in context: ModelContext) throws {
        let profiles = try context.fetch(FetchDescriptor<BusinessProfile>())
        guard profiles.count <= 1 else { throw DurableSyncError.invalidIdentity }
        guard let profile = profiles.first, let business = profile.businessId else { try context.save(); return }
        guard let owner = profile.assignedByUserId, !owner.isEmpty else { throw DurableSyncError.invalidIdentity }
        let services = try context.fetch(FetchDescriptor<GroomingService>())
        let clients = try context.fetch(FetchDescriptor<Client>())
        let pets = try context.fetch(FetchDescriptor<Pet>())
        let appointments = try context.fetch(FetchDescriptor<Appointment>())
        let all: [any BusinessRecord] = services.map { $0 as any BusinessRecord } + clients.map { $0 as any BusinessRecord } + pets.map { $0 as any BusinessRecord } + appointments.map { $0 as any BusinessRecord }
        var ids = Set<UUID>()
        for record in all {
            guard record.businessId == business, let id = record.recordUUID, ids.insert(id).inserted else { throw DurableSyncError.invalidIdentity }
        }
        func ref(_ record: (any BusinessRecord)?) throws -> Any {
            guard let record else { return NSNull() }
            guard record.businessId == business, let id = record.recordUUID, ids.contains(id) else { throw DurableSyncError.invalidIdentity }
            return id.uuidString.lowercased()
        }
        var snapshots: [(UUID, String, String)] = []
        func add(_ record: any BusinessRecord, _ type: String, _ payload: [String: Any]) throws {
            let data = try JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys])
            snapshots.append((record.recordUUID!, type, String(decoding: data, as: UTF8.self)))
        }
        for service in services { try add(service, "service", ["name": service.name, "durationMinutes": service.durationMinutes, "priceMinor": service.priceMinor, "depositMinor": service.depositMinor, "prepInstructions": service.prepInstructions, "isArchived": service.isArchived]) }
        for client in clients { try add(client, "client", ["name": client.name, "phone": client.phone, "email": client.email, "notes": client.notes]) }
        for pet in pets { try add(pet, "pet", ["name": pet.name, "breed": pet.breed, "size": pet.sizeRaw, "groomingNotes": pet.groomingNotes, "handlingNotes": pet.handlingNotes, "clientUUID": try ref(pet.client)]) }
        for appointment in appointments {
            if let petClient = appointment.pet?.client, let client = appointment.client, petClient !== client { throw DurableSyncError.invalidIdentity }
            try add(appointment, "appointment", ["scheduledAt": ISO8601DateFormatter().string(from: appointment.scheduledAt), "serviceNameSnapshot": appointment.serviceNameSnapshot, "durationMinutesSnapshot": appointment.durationMinutesSnapshot, "priceMinorSnapshot": appointment.priceMinorSnapshot, "depositMinorSnapshot": appointment.depositMinorSnapshot, "notes": appointment.notes, "status": appointment.statusRaw, "paymentStatus": appointment.paymentStatusRaw, "cancellationReason": appointment.cancellationReason, "clientUUID": try ref(appointment.client), "petUUID": try ref(appointment.pet), "serviceUUID": try ref(appointment.service)])
        }
        // Validate all records before adding any queue entries.
        for (id, type, payload) in snapshots {
            try DurableSyncOutbox.enqueue(in: context, businessId: business, recordUUID: id, ownerUserId: owner, recordType: type, payloadJSON: payload, save: false)
        }
        for point in try context.fetch(FetchDescriptor<SyncRecordCheckpoint>()) where point.businessId == business && point.ownerUserId == owner && !ids.contains(point.recordUUID) {
            try DurableSyncOutbox.enqueue(in: context, businessId: business, recordUUID: point.recordUUID, ownerUserId: owner, recordType: point.recordType, action: "delete", payloadJSON: "{}", save: false)
        }
        try context.save()
    }
}
