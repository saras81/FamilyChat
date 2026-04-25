# FamilyChat - Private Family Messaging App

A high-security, family-focused messaging application for iOS and Apple Watch that provides safe communication between family members with parental controls.

## 🏗️ Project Structure

```
FamilyChat/
├── src/
│   ├── database/
│   │   └── DatabaseService.js          # SQLite database management
│   ├── services/
│   │   └── MatrixService.js            # Matrix SDK integration
│   └── components/
│       ├── App.js                      # Main app entry point
│       ├── SafeListScreen.js           # Kid-friendly contact list
│       ├── ChatScreen.js               # Messaging interface
│       ├── ParentSettingsScreen.js     # Parental controls & purge
│       ├── ParentOnboardingScreen.js   # Parent setup flow
│       └── ChildOnboardingScreen.js   # Child setup flow
├── FamilyChatWatch/                    # Apple Watch companion app
│   ├── ContentView.swift               # Watch app UI
│   └── FamilyChatWatchApp.swift        # Watch app entry point
└── package.json                        # Dependencies and scripts
```

## 🚀 Core Features

### ✅ Implemented

- **SQLite Database Schema**
  - Messages table with Matrix sync metadata
  - Contacts/family members table with Safe List support
  - Family and device management tables
  - Media file path storage

- **Matrix SDK Integration**
  - Secure backend communication via Matrix.org
  - End-to-end encryption support
  - Real-time message synchronization
  - Device registration and management

- **Kid-Friendly UI**
  - Large, readable text with rounded fonts
  - Simple color scheme (blue/white)
  - Safe List contact management
  - Message bubbles with status indicators
  - Child-appropriate navigation

- **Parental Controls**
  - **Parental Purge**: Complete data deletion
    - Wipes all SQLite data
    - Deletes local media files
    - Logs out of Matrix
    - Requires confirmation dialog

- **Onboarding Flows**
  - **Parent Flow**: Family creation, child profile setup, QR code generation
  - **Child Flow**: QR code scanning, family joining, device provisioning

- **Apple Watch Companion**
  - SwiftUI-based watch app
  - Safe List contact display
  - Last message preview (read-only)
  - Watch Connectivity framework setup

### 🔧 Security Features

- **No Third-Party Analytics**: Zero tracking libraries
- **Local-First Storage**: SQLite for offline access
- **End-to-End Encryption**: Via Matrix protocol
- **Parental Purge**: Complete data wipe capability
- **Safe List Model**: Parents control who children can message

## 📱 Installation & Setup

### Prerequisites
- Node.js 16+
- Expo CLI
- Xcode (for iOS development)
- Apple Developer Account (for device testing)

### Mobile App Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm start
   ```

3. **Run on iOS Simulator**
   ```bash
   npm run ios
   ```

### Apple Watch App Setup

1. **Add Watch Target in Xcode**
   - Open `ios/FamilyChat.xcworkspace`
   - File → New → Target → watchOS → App
   - Name: `FamilyChatWatch`

2. **Replace Watch App Files**
   - Copy `FamilyChatWatch/` directory contents to Xcode watch target

3. **Configure Watch Connectivity**
   - Enable Watch Connectivity capability
   - Set up WCSession delegate in iOS app

## 🗄️ Database Schema

### Contacts Table
```sql
CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar_path TEXT,
  is_child INTEGER DEFAULT 0,
  is_safe_list INTEGER DEFAULT 0,
  matrix_user_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Messages Table
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  body TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'sent',
  media_path TEXT,
  matrix_event_id TEXT,
  FOREIGN KEY (sender_id) REFERENCES contacts (id),
  FOREIGN KEY (recipient_id) REFERENCES contacts (id)
);
```

## 🔐 Account Model

### Parent Account Creation
1. Parent creates family account
2. Adds child profiles (name, avatar)
3. Generates 6-digit device link code
4. Shares code/QR with child

### Child Account Setup
1. Child installs app
2. Selects "Join my family"
3. Scans QR or enters 6-digit code
4. App provisions Matrix device keys
5. Child can only message Safe List contacts

### Safe List Management
- Parents control who children can message
- Children see only approved contacts
- Real-time sync between devices

## 📋 TODO Items

### High Priority
- [ ] QR code generation for parent devices
- [ ] Enhanced error handling and user feedback
- [ ] Message status indicators (sending, sent, failed)
- [ ] Push notifications for new messages

### Medium Priority
- [ ] Activity reporting for parents
- [ ] Media file sharing (images, videos)
- [ ] Voice message support
- [ ] Message search functionality

### Low Priority
- [ ] Apple Watch full conversation view
- [ ] Custom avatar creation
- [ ] Message themes and customization
- [ ] Offline message queueing

## 🛠️ Development Commands

```bash
# Start development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android (if supported)
npm run android

# Build for production
expo build:ios

# Clear cache
expo start -c
```

## 📚 Key Dependencies

- `expo-sqlite` - Local SQLite database
- `matrix-js-sdk` - Matrix protocol integration
- `expo-camera` - QR code scanning
- `@react-navigation/*` - Navigation stack
- `react-native-screens` - Native navigation optimization

## 🔒 Privacy & Security

- **Zero Analytics**: No third-party tracking
- **Local Storage**: Messages stored locally with SQLite
- **End-to-End Encryption**: Matrix protocol ensures privacy
- **Parental Control**: Complete data deletion capability
- **Safe List**: Restricted communication model

## 📞 Support

For issues or questions:
1. Check the TODO section for planned features
2. Review the database schema documentation
3. Examine the Matrix service implementation
4. Test onboarding flows with QR codes

---

**Note**: This is a proof-of-concept implementation. Production deployment requires additional security testing, Matrix homeserver setup, and App Store configuration.
