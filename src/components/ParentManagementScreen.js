import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  TextInput
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import DatabaseService from '../database/DatabaseService';
import MatrixService from '../services/MatrixService';

const palette = {
  primary: '#1E2A78',
  background: '#F4F6FF',
  panel: '#FFFFFF',
  border: '#DDE4FF',
  muted: '#65708A',
  success: '#14804A',
  danger: '#C92A2A',
  dangerBg: '#FFF0F0'
};

const ParentManagementScreen = () => {
  const [familyName, setFamilyName] = useState('Family Dashboard');
  const [children, setChildren] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [invites, setInvites] = useState([]);
  const [activityFeed, setActivityFeed] = useState([]);
  const [newInviteName, setNewInviteName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    const [allContacts, family, childInvites, activity] = await Promise.all([
      DatabaseService.getAllContacts(),
      DatabaseService.getFamily(),
      DatabaseService.getChildInvites(),
      DatabaseService.getChildActivity(30)
    ]);

    setContacts(allContacts);
    setChildren(allContacts.filter(contact => contact.is_child));
    setFamilyName(family?.family_name || 'Family Dashboard');
    setInvites(childInvites);
    setActivityFeed(activity);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const generateInvite = async () => {
    setIsLoading(true);
    try {
      const result = await DatabaseService.createChildInvite(newInviteName.trim() || 'Child slot');
      if (!result.success) throw new Error(result.error);

      // Stand up the Matrix room for this code so the invited child can join it
      // from another device. No-op if the homeserver is unreachable.
      if (result.invite?.code && MatrixService.isReady()) {
        await MatrixService.getOrCreateRoomForCode(result.invite.code);
      }

      setNewInviteName('');
      await loadDashboard();
    } catch (error) {
      Alert.alert('Invite Error', error.message || 'Could not create invite code.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyInvite = async (code) => {
    await Clipboard.setStringAsync(`familychat:${code}`);
    Alert.alert('Invite Copied', 'The FamilyChat invite code was copied.');
  };

  const setApproval = async (contact, isApproved) => {
    await DatabaseService.setContactApproval(contact.id, isApproved);
    await loadDashboard();
  };

  const handlePurgeData = () => {
    Alert.alert(
      'Purge Chat History',
      'This will permanently delete local chat history and media from this device. Family members and invites will remain.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purge Data',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              const result = await DatabaseService.purgeChatHistory();
              if (!result.success) throw new Error(result.error);
              await loadDashboard();
              Alert.alert('Data Purged', 'Chat history has been deleted.');
            } catch (error) {
              Alert.alert('Purge Failed', error.message || 'Could not purge chat history.');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const Module = ({ title, subtitle, children: moduleChildren, danger = false }) => (
    <View style={[styles.module, danger && styles.dangerModule]}>
      <View style={styles.moduleHeader}>
        <Text style={[styles.moduleTitle, danger && styles.dangerTitle]}>{title}</Text>
        {subtitle ? <Text style={styles.moduleSubtitle}>{subtitle}</Text> : null}
      </View>
      {moduleChildren}
    </View>
  );

  const EmptyText = ({ children }) => (
    <Text style={styles.emptyText}>{children}</Text>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{familyName}</Text>
        <Text style={styles.headerSubtitle}>Parent controls, invites, activity, and privacy</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Module
          title="Family Manager"
          subtitle="Linked children in this family unit"
        >
          {children.length === 0 ? (
            <EmptyText>No linked children yet. Create an invite below to add one.</EmptyText>
          ) : (
            children.map(child => (
              <View key={child.id} style={styles.row}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{child.display_name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{child.display_name}</Text>
                  <Text style={styles.rowSubtitle}>{child.handle || child.matrix_user_id || 'Child account'}</Text>
                </View>
                <View style={styles.statusPill}>
                  <Text style={styles.statusPillText}>Linked</Text>
                </View>
              </View>
            ))
          )}
        </Module>

        <Module
          title="Invite Center"
          subtitle="Generate a unique string or QR payload for each child slot"
        >
          <View style={styles.inviteForm}>
            <TextInput
              style={styles.inviteInput}
              value={newInviteName}
              onChangeText={setNewInviteName}
              placeholder="Child slot name"
              placeholderTextColor="#8A8F99"
            />
            <TouchableOpacity
              style={[styles.primaryButton, isLoading && styles.disabledButton]}
              onPress={generateInvite}
              disabled={isLoading}
            >
              <Text style={styles.primaryButtonText}>Generate</Text>
            </TouchableOpacity>
          </View>

          {invites.length === 0 ? (
            <EmptyText>No invite codes yet.</EmptyText>
          ) : (
            invites.map(invite => (
              <View key={invite.id} style={styles.inviteCard}>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{invite.child_name || 'Child slot'}</Text>
                  <Text style={styles.qrPayload}>QR payload: familychat:{invite.code}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.codeButton, invite.status !== 'open' && styles.usedCodeButton]}
                  onPress={() => copyInvite(invite.code)}
                  disabled={invite.status !== 'open'}
                >
                  <Text style={styles.codeButtonText}>{invite.status === 'open' ? invite.code : 'USED'}</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </Module>

        <Module
          title="Activity Monitor"
          subtitle="Read-only child message activity"
        >
          {activityFeed.length === 0 ? (
            <EmptyText>No child messages have been recorded yet.</EmptyText>
          ) : (
            activityFeed.map(item => (
              <View key={`${item.id}-${item.timestamp}`} style={styles.activityRow}>
                <Text style={styles.activityTitle}>{item.child_name || item.sender_id}</Text>
                <Text style={styles.activityText} numberOfLines={2}>{item.body}</Text>
                <Text style={styles.activityTime}>{new Date(item.timestamp).toLocaleString()}</Text>
              </View>
            ))
          )}
        </Module>

        <Module
          title="The Safelist"
          subtitle="Approve or block contact handles"
        >
          {contacts.length === 0 ? (
            <EmptyText>No contacts yet.</EmptyText>
          ) : (
            contacts.map(contact => {
              const approved = contact.approval_status !== 'blocked' && contact.is_safe_list;
              return (
                <View key={contact.id} style={styles.row}>
                  <View style={[styles.avatar, !approved && styles.blockedAvatar]}>
                    <Text style={styles.avatarText}>{contact.display_name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>{contact.display_name}</Text>
                    <Text style={styles.rowSubtitle}>{contact.handle || contact.matrix_user_id || 'No handle'}</Text>
                  </View>
                  <View style={styles.actionPair}>
                    <TouchableOpacity
                      style={[styles.smallButton, approved && styles.smallButtonActive]}
                      onPress={() => setApproval(contact, true)}
                    >
                      <Text style={[styles.smallButtonText, approved && styles.smallButtonTextActive]}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.smallButton, !approved && styles.blockButtonActive]}
                      onPress={() => setApproval(contact, false)}
                    >
                      <Text style={[styles.smallButtonText, !approved && styles.smallButtonTextActive]}>Block</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </Module>

        <Module
          title="Privacy Tools"
          subtitle="Danger zone"
          danger
        >
          <TouchableOpacity
            style={[styles.dangerButton, isLoading && styles.disabledButton]}
            onPress={handlePurgeData}
            disabled={isLoading}
          >
            <Text style={styles.dangerButtonText}>Purge Data</Text>
          </TouchableOpacity>
        </Module>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background
  },
  header: {
    backgroundColor: palette.primary,
    paddingTop: 62,
    paddingBottom: 24,
    paddingHorizontal: 22,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28
  },
  headerTitle: {
    fontSize: 29,
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#DDE4FF',
    marginTop: 5,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  content: {
    flex: 1,
    padding: 18
  },
  module: {
    backgroundColor: palette.panel,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#1B2452',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4
  },
  dangerModule: {
    backgroundColor: palette.dangerBg,
    borderWidth: 1,
    borderColor: '#FFD1D1'
  },
  moduleHeader: {
    marginBottom: 14
  },
  moduleTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: '#22283A',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  dangerTitle: {
    color: palette.danger
  },
  moduleSubtitle: {
    fontSize: 14,
    color: palette.muted,
    marginTop: 4,
    lineHeight: 19,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEF1FF'
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  blockedAvatar: {
    backgroundColor: '#8A1F1F'
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  rowBody: {
    flex: 1
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#22283A',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  rowSubtitle: {
    fontSize: 13,
    color: palette.muted,
    marginTop: 3,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  emptyText: {
    fontSize: 14,
    color: palette.muted,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  statusPill: {
    backgroundColor: '#E7F8EF',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10
  },
  statusPillText: {
    color: palette.success,
    fontSize: 12,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  inviteForm: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12
  },
  inviteInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: palette.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    backgroundColor: '#FBFCFF',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  primaryButton: {
    backgroundColor: palette.primary,
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEF1FF'
  },
  qrPayload: {
    fontSize: 12,
    color: palette.muted,
    marginTop: 3,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  codeButton: {
    backgroundColor: '#E7F8EF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 82,
    alignItems: 'center'
  },
  usedCodeButton: {
    backgroundColor: '#ECEEF4'
  },
  codeButtonText: {
    color: palette.success,
    fontWeight: '900',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  activityRow: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEF1FF'
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#22283A',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  activityText: {
    fontSize: 14,
    color: '#3A4153',
    lineHeight: 19,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  activityTime: {
    fontSize: 12,
    color: palette.muted,
    marginTop: 5,
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  actionPair: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 10
  },
  smallButton: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF'
  },
  smallButtonActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary
  },
  blockButtonActive: {
    backgroundColor: palette.danger,
    borderColor: palette.danger
  },
  smallButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#4A5065',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  smallButtonTextActive: {
    color: '#FFFFFF'
  },
  dangerButton: {
    backgroundColor: palette.danger,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center'
  },
  dangerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif'
  },
  disabledButton: {
    opacity: 0.55
  }
});

export default ParentManagementScreen;
