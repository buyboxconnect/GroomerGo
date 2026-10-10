#if DEBUG
import SwiftUI
import SwiftData
import CryptoKit

// Opt-in diagnostic uses an isolated store and expiring synthetic-only capability.
// It never reads the production account token or production business records.
@MainActor enum SyncValidation {
    static var enabled: Bool { ProcessInfo.processInfo.arguments.contains("-sync-validation") }
    static func argument(_ key: String) -> String {
        let args = ProcessInfo.processInfo.arguments
        guard let index = args.firstIndex(of: key), args.indices.contains(index + 1) else { return "" }
        return args[index + 1]
    }
    static var runId: String { argument("-run") }
    static var directory: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appending(path: "SyncValidation/" + runId)
    }
    static func container() throws -> ModelContainer {
        guard UUID(uuidString: runId) != nil else { throw DurableSyncError.invalidIdentity }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let schema = Schema([GroomingService.self, SyncOutboxItem.self, SyncRecordCheckpoint.self])
        let result = try ModelContainer(for: schema, configurations: ModelConfiguration(schema: schema, url: directory.appending(path: "records.store")))
        result.mainContext.autosaveEnabled = false
        try DurableSyncOutbox.recover(in: result.mainContext)
        return result
    }
}

struct SyncValidationView: View {
    @Environment(\.modelContext) private var context
    @State private var status = "Running disposable synchronization checks…"
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "arrow.triangle.2.circlepath").font(.largeTitle)
            Text("GroomerGo sync validation").font(.title2)
            Text(SyncValidation.argument("-phase")).font(.headline)
            Text(status).multilineTextAlignment(.center)
            Text("Disposable data · Live uploads paused").font(.footnote)
        }.padding().task { await run() }
    }

    private func run() async {
        let phase = SyncValidation.argument("-phase")
        var report: [String: Any] = ["phase": phase, "runId": SyncValidation.runId, "passed": false]
        var stage = "identity"
        do {
            let business = UUID(uuidString: SyncValidation.argument("-business"))!
            let recordId = UUID(uuidString: SyncValidation.argument("-record"))!
            stage = "keychain"
            let tokens = SecureTokenStore(service: "com.groomergo.sync-validation", account: SyncValidation.runId)
            if let capability = ProcessInfo.processInfo.environment["GROOMERGO_PROBE_CAPABILITY"] { try tokens.save(capability) }
            guard let capability = tokens.read() else { throw DurableSyncError.unauthenticated }
            report["sessionRestoredFromKeychain"] = ProcessInfo.processInfo.environment["GROOMERGO_PROBE_CAPABILITY"] == nil
            func call(_ action: String, mutation: Data? = nil) async throws -> (Data, Int) {
                var body: [String: Any] = ["action": action, "runId": SyncValidation.runId]
                if let mutation { body["mutation"] = try JSONSerialization.jsonObject(with: mutation) }
                var request = URLRequest(url: Base44Configuration.websiteURL.appending(path: "functions/creation-sync-probe"))
                request.httpMethod = "POST"; request.cachePolicy = .reloadIgnoringLocalCacheData
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                request.setValue(capability, forHTTPHeaderField: "X-GroomerGo-Probe-Capability")
                request.httpBody = try JSONSerialization.data(withJSONObject: body, options: [.sortedKeys])
                let (data, response) = try await URLSession.shared.data(for: request)
                return (data, (response as? HTTPURLResponse)?.statusCode ?? 0)
            }
            stage = "enqueue"
            if phase == "seed" || phase == "competing-create" {
                guard try context.fetch(FetchDescriptor<GroomingService>()).isEmpty else { throw DurableSyncError.duplicateIdentity }
                let service = GroomingService(name: "Disposable native fixture", durationMinutes: 60, priceMinor: 5000, depositMinor: 1000, prepInstructions: "Disposable fixture only", businessId: business)
                service.recordUUID = recordId; context.insert(service)
                let payload = try JSONSerialization.data(withJSONObject: ["name": service.name, "durationMinutes": service.durationMinutes, "priceMinor": service.priceMinor, "depositMinor": service.depositMinor, "prepInstructions": service.prepInstructions], options: [.sortedKeys])
                try DurableSyncOutbox.enqueue(in: context, businessId: business, recordUUID: recordId, ownerUserId: "disposable-validation", recordType: "service", payloadJSON: String(decoding: payload, as: UTF8.self))
            }
            stage = "send"
            if ["lost-ack", "retry", "competing-create"].contains(phase) {
                guard let item = try context.fetch(FetchDescriptor<SyncOutboxItem>()).first else { throw DurableSyncError.invalidIdentity }
                // Network outcome is injected; only the lost-ack phase discards a
                // successful server response. The same persisted queue handles it.
                do {
                    try await DurableSyncOutbox.send(item, in: context, authenticatedUserId: "disposable-validation") { data in
                        let (response, code) = try await call("push", mutation: data)
                        if code == 409 { throw DurableSyncError.conflict }
                        guard code == 200 else { throw DurableSyncError.deferred }
                        let receipt = try JSONDecoder().decode(MutationAcknowledgment.self, from: response)
                        report["serverOutcome"] = receipt.status
                        if phase == "lost-ack" { throw URLError(.networkConnectionLost) }
                        return receipt
                    }
                } catch {
                    guard phase == "lost-ack" && item.state == "pending" && report["serverOutcome"] as? String == "applied" || phase == "competing-create" && item.state == "conflict" else { throw error }
                }
                report["requestSHA256"] = SHA256.hash(data: Data((item.requestJSON ?? "").utf8)).map { String(format: "%02x", $0) }.joined()
            }
            stage = "download"
            if phase == "download" || phase == "competing-create" {
                let (data, code) = try await call("pull"); guard code == 200 else { throw DurableSyncError.deferred }
                struct Pull: Decodable { let records: [ServerRecord] }
                let rows = try JSONDecoder().decode(Pull.self, from: data).records
                guard rows.count == 1, let row = rows.first, row.businessId == business.uuidString.lowercased(), row.recordUUID == recordId.uuidString.lowercased(), row.revision == 1 else { throw DurableSyncError.invalidReceipt }
                let payload = try JSONSerialization.jsonObject(with: Data(row.payloadJSON.utf8)) as! [String: Any]
                let services = try context.fetch(FetchDescriptor<GroomingService>())
                guard services.count <= 1 else { throw DurableSyncError.duplicateIdentity }
                let service = services.first ?? GroomingService(name: "Disposable download", durationMinutes: 60, priceMinor: 0, businessId: business)
                if services.isEmpty { context.insert(service) }
                service.recordUUID = recordId; service.name = payload["name"] as! String
                service.priceMinor = payload["priceMinor"] as! Int; service.depositMinor = payload["depositMinor"] as! Int
                service.durationMinutes = payload["durationMinutes"] as! Int; service.prepInstructions = payload["prepInstructions"] as! String
                let point = try DurableSyncOutbox.checkpoint(in: context, businessId: business, recordUUID: recordId, ownerUserId: "disposable-validation", recordType: "service")
                point.serverRevision = row.revision; try context.save()
                report["downloadedRevision"] = row.revision
            }
            // Every phase confirms that the restored capability still works.
            stage = "verify-session"
            let (_, code) = try await call("pull"); guard code == 200 else { throw DurableSyncError.unauthenticated }
            let records = try context.fetch(FetchDescriptor<GroomingService>())
            let items = try context.fetch(FetchDescriptor<SyncOutboxItem>())
            let checkpoints = try context.fetch(FetchDescriptor<SyncRecordCheckpoint>())
            guard records.count == 1, records.first?.recordUUID == recordId, records.first?.businessId == business else { throw DurableSyncError.invalidIdentity }
            if phase == "retry" || phase == "reopen-a" { guard items.count == 1, items[0].state == "acknowledged", checkpoints.first?.serverRevision == 1 else { throw DurableSyncError.invalidReceipt } }
            if phase == "reopen-b" { guard items.count == 1, items[0].state == "conflict", checkpoints.first?.serverRevision == 1 else { throw DurableSyncError.invalidReceipt } }
            report["recordUUID"] = recordId.uuidString.lowercased(); report["localRecordCount"] = records.count
            report["queue"] = items.map { ["operationId": $0.operationId.uuidString.lowercased(), "state": $0.state, "attempts": $0.attempts, "hasFrozenRequest": $0.requestJSON != nil] as [String: Any] }
            report["serverRevision"] = checkpoints.first?.serverRevision ?? 0
            report["passed"] = true; status = "Passed · \(records.count) record preserved"
        } catch { report["failure"] = "VALIDATION_FAILED"; report["stage"] = stage; report["errorDomain"] = (error as NSError).domain; report["errorCode"] = (error as NSError).code; status = "Validation failed" }
        do {
            let data = try JSONSerialization.data(withJSONObject: report, options: [.sortedKeys, .prettyPrinted])
            try data.write(to: SyncValidation.directory.appending(path: phase + ".json"), options: .atomic)
        } catch { status = "Could not save evidence" }
    }
}
#endif
