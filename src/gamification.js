(function () {
    const STORAGE_KEY = 'campCalGamification';
    const MAX_LOG_ENTRIES = 200;
    const MAX_HISTORY_ENTRIES = 12;

    const ACTION_POINTS = {
        CREATE_EVENT: 100,
        RSVP_EVENT: 35,
        RSVP_RECEIVED: 15
    };

    function getCurrentSemesterId(dateObj = new Date()) {
        const month = dateObj.getMonth() + 1;
        const year = dateObj.getFullYear();

        let term = 'Fall';
        if (month >= 1 && month <= 5) {
            term = 'Spring';
        } else if (month >= 6 && month <= 8) {
            term = 'Summer';
        }

        return `${year}-${term}`;
    }

    function getLifetimeRankInfo(lifetimePoints) {
        if (lifetimePoints >= 1000) {
            return { rank: 'Legend', className: 'user-badge-legend', nextRank: 'Hall of Fame', nextThreshold: 1500 };
        }

        if (lifetimePoints >= 500) {
            return { rank: 'Gold', className: 'user-badge-gold', nextRank: 'Legend', nextThreshold: 1000 };
        }

        if (lifetimePoints >= 250) {
            return { rank: 'Silver', className: 'user-badge-silver', nextRank: 'Gold', nextThreshold: 500 };
        }

        return { rank: 'Bronze', className: 'user-badge-bronze', nextRank: 'Silver', nextThreshold: 250 };
    }

    function getUserBadgeInfo(userName) {
        const summary = getUserSummary(userName);
        const rankInfo = getLifetimeRankInfo(summary.lifetimePoints || 0);

        return {
            userName: summary.userName,
            lifetimePoints: summary.lifetimePoints || 0,
            rank: rankInfo.rank,
            className: rankInfo.className,
            nextRank: rankInfo.nextRank,
            nextThreshold: rankInfo.nextThreshold
        };
    }

    function applyNavbarUserLink(userLink, userName) {
        if (!userLink) {
            return;
        }

        const activeUser = (userName || '').trim();
        if (!activeUser) {
            userLink.textContent = 'Log In';
            userLink.href = 'auth.html';
            return;
        }

        const badgeInfo = getUserBadgeInfo(activeUser);
        userLink.innerHTML = `Welcome, ${activeUser} <span class="user-link-badge ${badgeInfo.className}">${badgeInfo.rank}</span>`;
        userLink.href = 'profilePreferences.html';
    }

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return {
                    currentSemesterId: getCurrentSemesterId(),
                    users: {},
                    eventRsvps: {},
                    semesterHistory: []
                };
            }

            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') {
                throw new Error('Invalid gamification state');
            }

            return {
                currentSemesterId: parsed.currentSemesterId || getCurrentSemesterId(),
                users: parsed.users || {},
                eventRsvps: parsed.eventRsvps || {},
                semesterHistory: Array.isArray(parsed.semesterHistory) ? parsed.semesterHistory : []
            };
        } catch (error) {
            console.error('Failed to parse gamification state:', error);
            return {
                currentSemesterId: getCurrentSemesterId(),
                users: {},
                eventRsvps: {},
                semesterHistory: []
            };
        }
    }

    function saveState(state) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function computeLeaderboardFromUsers(users, scoreField) {
        return Object.entries(users)
            .map(([userName, user]) => ({
                userName,
                semesterPoints: user.semesterPoints || 0,
                lifetimePoints: user.lifetimePoints || 0,
                score: user[scoreField] || 0
            }))
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                if (b.lifetimePoints !== a.lifetimePoints) return b.lifetimePoints - a.lifetimePoints;
                return a.userName.localeCompare(b.userName);
            })
            .map((entry, index) => ({
                rank: index + 1,
                userName: entry.userName,
                semesterPoints: entry.semesterPoints,
                lifetimePoints: entry.lifetimePoints
            }));
    }

    function archiveSemesterIfNeeded(state) {
        const leaderboard = computeLeaderboardFromUsers(state.users || {}, 'semesterPoints');
        const hasScoredUsers = leaderboard.some(entry => entry.semesterPoints > 0);

        if (!hasScoredUsers) {
            return;
        }

        const archive = {
            semesterId: state.currentSemesterId,
            archivedAt: new Date().toISOString(),
            leaderboard,
            userSummaries: Object.entries(state.users || {}).map(([userName, user]) => ({
                userName,
                semesterPoints: user.semesterPoints || 0,
                lifetimePoints: user.lifetimePoints || 0,
                actionsLogged: Array.isArray(user.semesterActionLog) ? user.semesterActionLog.length : 0
            }))
        };

        state.semesterHistory = [archive, ...(state.semesterHistory || [])].slice(0, MAX_HISTORY_ENTRIES);
    }

    function ensureSemester(state) {
        const currentId = getCurrentSemesterId();
        if (state.currentSemesterId === currentId) {
            return;
        }

        archiveSemesterIfNeeded(state);

        Object.keys(state.users).forEach(userName => {
            const user = state.users[userName];
            user.semesterPoints = 0;
            user.semesterActionLog = [];
        });

        state.eventRsvps = {};
        state.currentSemesterId = currentId;
    }

    function normalizeEventId(eventId) {
        return String(eventId ?? '');
    }

    function ensureUser(state, userName) {
        if (!userName) {
            return null;
        }

        if (!state.users[userName]) {
            state.users[userName] = {
                lifetimePoints: 0,
                semesterPoints: 0,
                actionLog: [],
                semesterActionLog: []
            };
        }

        return state.users[userName];
    }

    function trimLog(log) {
        if (!Array.isArray(log)) {
            return [];
        }

        if (log.length > MAX_LOG_ENTRIES) {
            return log.slice(0, MAX_LOG_ENTRIES);
        }

        return log;
    }

    function getEventRsvpList(state, eventId) {
        const normalizedEventId = normalizeEventId(eventId);
        const attendees = state.eventRsvps[normalizedEventId];

        if (!Array.isArray(attendees)) {
            state.eventRsvps[normalizedEventId] = [];
            return state.eventRsvps[normalizedEventId];
        }

        return attendees;
    }

    function getCurrentUserName() {
        return (localStorage.getItem('campCalUser') || '').trim();
    }

    function addActionToUser(state, userName, actionType, options = {}) {
        const points = ACTION_POINTS[actionType];
        if (!points) {
            return { success: false, reason: 'Unknown action type.' };
        }

        const targetUser = (userName || '').trim();
        if (!targetUser) {
            return { success: false, reason: 'No target user.' };
        }

        const user = ensureUser(state, targetUser);
        if (!user) {
            return { success: false, reason: 'Failed to initialize user.' };
        }

        const entry = {
            id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
            actionType,
            pointsDelta: points,
            actorUser: targetUser,
            eventId: options.eventId || null,
            eventTitle: options.eventTitle || null,
            targetUser: options.targetUser || null,
            timestamp: new Date().toISOString(),
            semesterId: state.currentSemesterId
        };

        user.lifetimePoints += points;
        user.semesterPoints += points;

        user.actionLog = trimLog([entry, ...(user.actionLog || [])]);
        user.semesterActionLog = trimLog([entry, ...(user.semesterActionLog || [])]);

        return {
            success: true,
            pointsAwarded: points,
            semesterPoints: user.semesterPoints,
            lifetimePoints: user.lifetimePoints
        };
    }

    function awardAction(actionType, options = {}) {
        const actorUser = (options.actorUser || getCurrentUserName() || '').trim();
        if (!actorUser) {
            return { success: false, reason: 'No active user.' };
        }

        const state = loadState();
        ensureSemester(state);
        const result = addActionToUser(state, actorUser, actionType, options);
        saveState(state);
        return result;
    }

    function hasRsvped(eventId, userName) {
        const activeUser = (userName || getCurrentUserName() || '').trim();
        if (!activeUser) {
            return false;
        }

        const state = loadState();
        const attendees = getEventRsvpList(state, eventId);
        return attendees.includes(activeUser);
    }

    function getRsvpCount(eventId) {
        const state = loadState();
        const attendees = getEventRsvpList(state, eventId);
        return attendees.length;
    }

    function rsvpEvent(eventData, actorUser) {
        const attendeeName = (actorUser || getCurrentUserName() || '').trim();
        if (!attendeeName) {
            return { success: false, reason: 'No active user.' };
        }

        const eventId = normalizeEventId(eventData && eventData.id);
        if (!eventId) {
            return { success: false, reason: 'Missing event id.' };
        }

        const state = loadState();
        ensureSemester(state);

        const attendees = getEventRsvpList(state, eventId);
        if (attendees.includes(attendeeName)) {
            return { success: false, reason: 'Already RSVPed.', duplicate: true };
        }

        attendees.push(attendeeName);

        const eventTitle = eventData.title || null;
        const creatorName = (eventData.createdBy || '').trim();

        const userResult = addActionToUser(state, attendeeName, 'RSVP_EVENT', {
            eventId,
            eventTitle,
            targetUser: creatorName || null
        });

        let creatorResult = null;
        if (creatorName && creatorName !== attendeeName) {
            creatorResult = addActionToUser(state, creatorName, 'RSVP_RECEIVED', {
                eventId,
                eventTitle,
                targetUser: attendeeName
            });
        }

        saveState(state);

        return {
            success: true,
            alreadyRsvped: false,
            rsvpCount: attendees.length,
            attendeeResult: userResult,
            creatorResult
        };
    }

    function getUserSummary(userName) {
        const activeUser = (userName || getCurrentUserName() || '').trim();
        const state = loadState();
        ensureSemester(state);

        if (!activeUser || !state.users[activeUser]) {
            saveState(state);
            return {
                userName: activeUser,
                semesterId: state.currentSemesterId,
                semesterPoints: 0,
                lifetimePoints: 0,
                recentActions: []
            };
        }

        const user = state.users[activeUser];
        saveState(state);

        return {
            userName: activeUser,
            semesterId: state.currentSemesterId,
            semesterPoints: user.semesterPoints || 0,
            lifetimePoints: user.lifetimePoints || 0,
            recentActions: (user.semesterActionLog || []).slice(0, 8)
        };
    }

    function getLeaderboard(options = {}) {
        const scope = options.scope === 'lifetime' ? 'lifetime' : 'semester';
        const limit = Number.isInteger(options.limit) ? options.limit : 10;
        const state = loadState();
        ensureSemester(state);

        const scoreField = scope === 'lifetime' ? 'lifetimePoints' : 'semesterPoints';
        const entries = computeLeaderboardFromUsers(state.users || {}, scoreField)
            .slice(0, Math.max(1, limit));

        saveState(state);
        return {
            semesterId: state.currentSemesterId,
            scope,
            entries
        };
    }

    function getSemesterHistory(limit = 6) {
        const state = loadState();
        ensureSemester(state);
        const safeLimit = Number.isInteger(limit) ? Math.max(1, limit) : 6;
        saveState(state);
        return (state.semesterHistory || []).slice(0, safeLimit);
    }

    function init() {
        const state = loadState();
        ensureSemester(state);

        const currentUser = getCurrentUserName();
        if (currentUser) {
            ensureUser(state, currentUser);
        }

        saveState(state);
    }

    window.CampCalGamification = {
        ACTION_POINTS,
        getCurrentSemesterId,
        getLifetimeRankInfo,
        getUserBadgeInfo,
        applyNavbarUserLink,
        getCurrentUserName,
        awardAction,
        hasRsvped,
        getRsvpCount,
        rsvpEvent,
        getUserSummary,
        getLeaderboard,
        getSemesterHistory,
        init
    };
})();
