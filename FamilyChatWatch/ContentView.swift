import SwiftUI
import WatchConnectivity

struct ContentView: View {
    @StateObject private var watchManager = WatchManager()
    @State private var safeListContacts: [WatchContact] = []
    @State private var isLoading = true
    
    var body: some View {
        NavigationView {
            Group {
                if isLoading {
                    LoadingView()
                } else if safeListContacts.isEmpty {
                    EmptySafeListView()
                } else {
                    SafeListView(contacts: safeListContacts)
                }
            }
            .navigationTitle("Safe List")
            .navigationBarTitleDisplayMode(.inline)
        }
        .onAppear {
            loadSafeList()
        }
        .environmentObject(watchManager)
    }
    
    private func loadSafeList() {
        isLoading = true
        
        // TODO: Implement actual data sync with iPhone app
        // For now, using mock data
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            safeListContacts = [
                WatchContact(
                    id: "1",
                    displayName: "Mom",
                    avatarPath: nil,
                    lastMessage: "Don't forget your lunch!",
                    lastMessageTime: "10:30 AM"
                ),
                WatchContact(
                    id: "2", 
                    displayName: "Dad",
                    avatarPath: nil,
                    lastMessage: "See you tonight!",
                    lastMessageTime: "8:15 AM"
                ),
                WatchContact(
                    id: "3",
                    displayName: "Grandma",
                    avatarPath: nil,
                    lastMessage: "Love you!",
                    lastMessageTime: "Yesterday"
                )
            ]
            isLoading = false
        }
        
        // TODO: Uncomment when Watch Connectivity is implemented
        // watchManager.requestSafeListData()
    }
}

struct LoadingView: View {
    var body: some View {
        VStack(spacing: 12) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: .blue))
            Text("Loading...")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct EmptySafeListView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "person.3")
                .font(.system(size: 32))
                .foregroundColor(.blue)
            
            Text("No Safe List")
                .font(.headline)
                .fontWeight(.bold)
            
            Text("Ask your parent to add contacts to your Safe List")
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct SafeListView: View {
    let contacts: [WatchContact]
    
    var body: some View {
        List(contacts, id: \.id) { contact in
            SafeListRow(contact: contact)
        }
        .listStyle(PlainListStyle())
    }
}

struct SafeListRow: View {
    let contact: WatchContact
    
    var body: some View {
        HStack(spacing: 12) {
            // Avatar
            ZStack {
                Circle()
                    .fill(Color.blue.opacity(0.1))
                    .frame(width: 32, height: 32)
                
                if let avatarPath = contact.avatarPath {
                    // TODO: Load actual avatar image
                    Image(systemName: "person.fill")
                        .font(.system(size: 16))
                        .foregroundColor(.blue)
                } else {
                    Text(String(contact.displayName.prefix(1)))
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundColor(.blue)
                }
            }
            
            // Contact info
            VStack(alignment: .leading, spacing: 2) {
                Text(contact.displayName)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.primary)
                
                if let lastMessage = contact.lastMessage {
                    Text(lastMessage)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            }
            
            Spacer()
            
            // Time
            if let lastMessageTime = contact.lastMessageTime {
                Text(lastMessageTime)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        // TODO: Implement tap action for viewing full conversation
        .onTapGesture {
            // TODO: Navigate to conversation view (read-only)
            print("Tapped contact: \(contact.displayName)")
        }
    }
}

// MARK: - Data Models

struct WatchContact: Identifiable, Codable {
    let id: String
    let displayName: String
    let avatarPath: String?
    let lastMessage: String?
    let lastMessageTime: String?
}

// MARK: - Watch Connectivity Manager

class WatchManager: NSObject, ObservableObject, WCSessionDelegate {
    private var session: WCSession?
    
    override init() {
        super.init()
        if WCSession.isSupported() {
            session = WCSession.default
            session?.delegate = self
            session?.activate()
        }
    }
    
    func requestSafeListData() {
        guard let session = session, session.isReachable else {
            print("Watch session is not reachable")
            return
        }
        
        // TODO: Send message to iPhone app requesting Safe List data
        let message = ["request": "safeList"]
        session.sendMessage(message, replyHandler: { response in
            // TODO: Handle Safe List data response
            print("Received safe list response: \(response)")
        }) { error in
            print("Error requesting safe list: \(error.localizedDescription)")
        }
    }
    
    // MARK: - WCSessionDelegate
    
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        if let error = error {
            print("Watch session activation failed: \(error.localizedDescription)")
        } else {
            print("Watch session activated with state: \(activationState)")
        }
    }
    
    func sessionDidBecomeInactive(_ session: WCSession) {
        print("Watch session became inactive")
    }
    
    func sessionDidDeactivate(_ session: WCSession) {
        print("Watch session deactivated")
        // TODO: Reactivate session
    }
    
    func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        DispatchQueue.main.async {
            // TODO: Handle messages from iPhone app
            if let safeListData = message["safeList"] as? Data {
                // TODO: Decode Safe List data
                print("Received safe list data")
            }
        }
    }
}

// MARK: - Preview

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
