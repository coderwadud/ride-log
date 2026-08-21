import React, { useState, useEffect } from 'react';
import { UserPlus, Users, Trash2, Search, Loader, User, UserCheck, X, Crown } from 'lucide-react';
import { translations } from '../utils/translations';
import {
  listenToTourMembers, addTourMember, addGuestMember,
  removeTourMember, removeGuestMember, updateMemberField,
  lookupUserByEmail, lookupUserByPhone
} from '../utils/tourStorage';

export default function TourMembersTab({ tourId, tour, lang = 'bn', user, isOrganizer }) {
  const t = translations[lang] || translations['bn'];
  const [members, setMembers] = useState([]);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addMode, setAddMode] = useState('registered'); // 'registered' | 'guest'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const unsub = listenToTourMembers(tourId, setMembers);
    return unsub;
  }, [tourId]);

  const allMemberIds = members.map(m => m.uid);

  // ── Search registered user ─────────────────────────────────────────────────
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchResult(null);
    setSearchError('');
    try {
      let found = null;
      if (searchQuery.includes('@')) {
        found = await lookupUserByEmail(searchQuery.trim());
      } else {
        found = await lookupUserByPhone(searchQuery.trim());
      }
      if (found) {
        setSearchResult(found);
      } else {
        setSearchError(t.userNotFound);
      }
    } catch {
      setSearchError(t.userNotFound);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAddRegistered = async () => {
    if (!searchResult) return;
    if (allMemberIds.includes(searchResult.uid)) { setSearchError(t.memberAlreadyAdded); return; }
    setAdding(true);
    await addTourMember(tourId, searchResult);
    setSearchResult(null);
    setSearchQuery('');
    setShowAddPanel(false);
    setAdding(false);
  };

  // ── Add guest ──────────────────────────────────────────────────────────────
  const handleAddGuest = async () => {
    if (!guestName.trim()) return;
    setAdding(true);
    await addGuestMember(tourId, { name: guestName.trim(), phone: guestPhone.trim() });
    setGuestName('');
    setGuestPhone('');
    setShowAddPanel(false);
    setAdding(false);
  };

  // ── Remove member ──────────────────────────────────────────────────────────
  const handleRemoveRegistered = async (member) => {
    if (!window.confirm(t.confirmRemoveMember)) return;
    await removeTourMember(tourId, member.uid);
  };

  const handleRemoveGuest = async (guest) => {
    if (!window.confirm(t.confirmRemoveMember)) return;
    await removeGuestMember(tourId, guest);
  };

  const guestMembers = tour?.guestMembers || [];

  return (
    <div className="tour-members-tab">
      <div className="tour-tab-section-header">
        <span><Users size={16} /> {t.members} ({members.length + guestMembers.length})</span>
        {isOrganizer && (
          <button className="tour-add-btn" onClick={() => setShowAddPanel(p => !p)}>
            <UserPlus size={15} /> {t.addMember}
          </button>
        )}
      </div>

      {/* Add Member Panel */}
      {showAddPanel && isOrganizer && (
        <div className="tour-add-panel">
          <div className="tour-add-mode-toggle">
            <button
              className={addMode === 'registered' ? 'active' : ''}
              onClick={() => setAddMode('registered')}
            >
              <UserCheck size={14} /> {t.addMember}
            </button>
            <button
              className={addMode === 'guest' ? 'active' : ''}
              onClick={() => setAddMode('guest')}
            >
              <User size={14} /> {t.addGuest}
            </button>
          </div>

          {addMode === 'registered' ? (
            <div className="tour-search-wrap">
              <div className="tour-search-row">
                <input
                  className="tour-input"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={t.searchByEmailOrPhone}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                <button className="tour-search-btn" onClick={handleSearch} disabled={searchLoading}>
                  {searchLoading ? <Loader size={15} className="spin" /> : <Search size={15} />}
                </button>
              </div>
              {searchError && <p className="tour-search-error">{searchError}</p>}
              {searchResult && (
                <div className="tour-search-found">
                  {searchResult.photoURL ? (
                    <img src={searchResult.photoURL} alt="" className="tour-member-avatar" />
                  ) : (
                    <div className="tour-member-avatar-placeholder">{(searchResult.displayName || '?')[0]}</div>
                  )}
                  <div className="tour-search-found-info">
                    <strong>{searchResult.displayName}</strong>
                    <span>{searchResult.email}</span>
                  </div>
                  <button className="tour-btn-primary small" onClick={handleAddRegistered} disabled={adding}>
                    {adding ? <Loader size={14} className="spin" /> : <UserPlus size={14} />}
                    {lang === 'bn' ? 'যোগ করুন' : 'Add'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="tour-guest-form">
              <input
                className="tour-input"
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                placeholder={t.guestName + ' *'}
              />
              <input
                className="tour-input"
                value={guestPhone}
                onChange={e => setGuestPhone(e.target.value)}
                placeholder={t.guestPhone}
              />
              <button className="tour-btn-primary" onClick={handleAddGuest} disabled={adding || !guestName.trim()}>
                {adding ? <Loader size={14} className="spin" /> : <UserPlus size={14} />}
                {t.addGuest}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Registered Members List */}
      <div className="tour-member-list">
        {members.map(member => (
          <MemberRow
            key={member.uid}
            member={member}
            isCurrentUser={member.uid === user?.uid}
            isOrganizer={isOrganizer}
            lang={lang}
            t={t}
            onRemove={() => handleRemoveRegistered(member)}
            onToggleLocation={(val) => updateMemberField(tourId, member.uid, { shareLocation: val })}
          />
        ))}

        {/* Guest Members */}
        {guestMembers.map(guest => (
          <GuestRow
            key={guest.id}
            guest={guest}
            isOrganizer={isOrganizer}
            lang={lang}
            t={t}
            onRemove={() => handleRemoveGuest(guest)}
          />
        ))}

        {members.length === 0 && guestMembers.length === 0 && (
          <div className="tour-empty-sub">{lang === 'bn' ? 'কোনো সদস্য নেই' : 'No members yet'}</div>
        )}
      </div>
    </div>
  );
}

function MemberRow({ member, isCurrentUser, isOrganizer, lang, t, onRemove, onToggleLocation }) {
  const canRemove = isOrganizer && !isCurrentUser && member.role !== 'organizer';
  const initials = (member.name || member.displayName || '?')[0].toUpperCase();

  return (
    <div className="tour-member-row">
      <div className="tour-member-left">
        {member.photoURL ? (
          <img src={member.photoURL} alt="" className="tour-member-avatar" />
        ) : (
          <div className="tour-member-avatar-placeholder">{initials}</div>
        )}
        <div className="tour-member-info">
          <div className="tour-member-name">
            {member.name || member.displayName}
            {member.role === 'organizer' && <Crown size={12} className="tour-organizer-icon" />}
            {isCurrentUser && <span className="tour-you-badge">{lang === 'bn' ? '(আমি)' : '(You)'}</span>}
          </div>
          <div className="tour-member-email">{member.email}</div>
        </div>
      </div>
      <div className="tour-member-right">
        {isCurrentUser && (
          <button
            className={`tour-location-toggle ${member.shareLocation ? 'on' : 'off'}`}
            onClick={() => onToggleLocation(!member.shareLocation)}
            title={t.shareLocation}
          >
            📍 {member.shareLocation ? t.liveLocationOn : t.liveLocationOff}
          </button>
        )}
        {!isCurrentUser && (
          <span className={`tour-member-status ${member.status}`}>
            {member.status === 'accepted' ? '✅' : member.status === 'invited' ? '⏳' : '❌'}
            {lang === 'bn'
              ? member.status === 'accepted' ? t.statusAccepted : member.status === 'invited' ? t.statusInvited : t.statusDeclined
              : member.status}
          </span>
        )}
        {canRemove && (
          <button className="tour-remove-btn" onClick={onRemove}><Trash2 size={14} /></button>
        )}
      </div>
    </div>
  );
}

function GuestRow({ guest, isOrganizer, lang, t, onRemove }) {
  return (
    <div className="tour-member-row guest">
      <div className="tour-member-left">
        <div className="tour-member-avatar-placeholder guest">{(guest.name || '?')[0].toUpperCase()}</div>
        <div className="tour-member-info">
          <div className="tour-member-name">
            {guest.name}
            <span className="tour-guest-badge">{lang === 'bn' ? 'গেস্ট' : 'Guest'}</span>
          </div>
          {guest.phone && <div className="tour-member-email">{guest.phone}</div>}
        </div>
      </div>
      <div className="tour-member-right">
        <span className="tour-member-status accepted">✅ {t.statusAccepted}</span>
        {isOrganizer && (
          <button className="tour-remove-btn" onClick={onRemove}><Trash2 size={14} /></button>
        )}
      </div>
    </div>
  );
}
