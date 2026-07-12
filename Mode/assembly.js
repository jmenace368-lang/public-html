let parties = [];
let coalitions = [];
let roster = [];
let bills = [];
let decrees = [];
let committeeCategoryColors = {
    "Special Committees": "#c52237",
    "Standing Committees": "#1e90ff",
    "Ad Hoc Committees": "#32cd32"
};
let committees = [];

let totalSeats = 0;
let displaySeatCount = 0;
let showSeatFraction = true;
let denseRows = true;
let electionDate = 'TBA';

const ASSEMBLY_DATA_URL = 'https://raw.githubusercontent.com/jmenace368-lang/data-assembly/refs/heads/main/assembly-data.json';
const ASSEMBLY_DATA_POLL_MS = 60000;
const defaultLogo = "https://combineoverwiki.net/images/thumb/3/34/Wasteland_Scanner_logo.svg/470px-Wasteland_Scanner_logo.svg.png";
const vacantColor = "rgba(255,255,255,0)";
const vacantOpacity = "1";
const vacantStroke = "rgba(255,255,255,0.08)";

const dom = {};
const partyColorMap = {};

let activeViewMode = "none";
let currentSortField = null;
let isAscending = true;
let selectedTags = [];
let selectedStatuses = [];
let selectedTypes = [];
let lastFilterKey = '';
let cachedFilteredBills = [];

let activeTooltipCircle = null;
let seatHighlight = { mode: null, key: null, focusParty: null };
const PAGE_LOAD_TIME = new Date();

const DEFAULT_STATUS_CATALOGS = {
    bills: [
        { value: 'active', color: '#41cd89', background: 'rgba(65, 205, 137, 0.15)' },
        { value: 'pending', color: '#2980b9', background: 'rgba(41, 128, 185, 0.15)' },
        { value: 'passed', color: '#41cd89', background: 'rgba(65, 205, 137, 0.15)' },
        { value: 'rejected', color: '#d12121', background: 'rgba(209, 33, 33, 0.15)' },
        { value: 'withdrawn', color: '#8223ff', background: 'rgba(130, 35, 255, 0.08)' },
        { value: 'rescinded', color: 'rgb(255, 81, 0)', background: 'rgba(100, 44, 11, 0.15)' },
        { value: 'vetoed', color: '#ff6161', background: 'rgba(255, 57, 57, 0.08)' },
        { value: 'expired', color: '#9ca3af', background: 'rgba(107, 114, 128, 0.15)' },
        { value: 'on hold', color: '#2980b9', background: 'rgba(41, 128, 185, 0.15)' },
        { value: 'inactive', color: '#888888', background: 'rgba(107, 114, 128, 0.3)' }
    ],
    decrees: [
        { value: 'active', skipExpiry: false, color: '#41cd89', background: 'rgba(65, 205, 137, 0.15)' },
        { value: 'pending', skipExpiry: true, color: '#2980b9', background: 'rgba(41, 128, 185, 0.15)' },
        { value: 'on hold', skipExpiry: true, color: '#2980b9', background: 'rgba(41, 128, 185, 0.15)' },
        { value: 'withdrawn', skipExpiry: true, color: '#8223ff', background: 'rgba(130, 35, 255, 0.08)' },
        { value: 'rescinded', skipExpiry: true, color: 'rgb(255, 81, 0)', background: 'rgba(100, 44, 11, 0.15)' },
        { value: 'expired', skipExpiry: false, color: '#9ca3af', background: 'rgba(107, 114, 128, 0.15)' },
        { value: 'inactive', skipExpiry: false, color: '#888888', background: 'rgba(107, 114, 128, 0.3)' }
    ],
    committees: [
        { value: 'active', color: '#41cd89', background: 'rgba(65, 205, 137, 0.15)' },
        { value: 'inactive', color: '#888888', background: 'rgba(107, 114, 128, 0.3)' }
    ]
};

let statusCatalogs = JSON.parse(JSON.stringify(DEFAULT_STATUS_CATALOGS));

function normalizeStatusCatalogs(raw) {
    const defaults = JSON.parse(JSON.stringify(DEFAULT_STATUS_CATALOGS));
    const src = raw && typeof raw === 'object' ? raw : {};
    const mapList = (list, withSkip, defaultList) => {
        if (!Array.isArray(list) || !list.length) return null;
        return list.map(item => {
            const value = typeof item === 'string'
                ? item.trim()
                : String(item?.value || item?.name || '').trim();
            if (!value) return null;
            const def = defaultList.find(
                d => String(d.value || '').trim().toLowerCase() === value.toLowerCase()
            );
            const entry = {
                value,
                color: (typeof item === 'object' && (item.color || item.textColor))
                    || def?.color
                    || '',
                background: (typeof item === 'object' && (item.background || item.bg || item.backgroundColor))
                    || def?.background
                    || ''
            };
            if (withSkip) {
                if (typeof item === 'object' && item.skipExpiry !== undefined) {
                    entry.skipExpiry = Boolean(item.skipExpiry);
                } else {
                    entry.skipExpiry = Boolean(def?.skipExpiry);
                }
            }
            return entry;
        }).filter(Boolean);
    };
    return {
        bills: mapList(src.bills, false, defaults.bills) || defaults.bills,
        decrees: mapList(src.decrees, true, defaults.decrees) || defaults.decrees,
        committees: mapList(src.committees, false, defaults.committees) || defaults.committees
    };
}

function getDecreeSkipExpiryStatuses() {
    const fromCatalog = (statusCatalogs.decrees || [])
        .filter(s => s && s.skipExpiry)
        .map(s => String(s.value || '').trim().toLowerCase())
        .filter(Boolean);
    return fromCatalog.length
        ? fromCatalog
        : ['rescinded', 'withdrawn', 'on hold', 'pending'];
}

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

function setActiveTab(tabId) {
    $$('.tab-content').forEach(t => t.classList.remove('active'));
    $$('.terminal-nav .terminal-btn').forEach(b => b.classList.remove('active'));
    const tab = $(`#${tabId}`);
    if (tab) tab.classList.add('active');
    const button = $(`.terminal-nav .terminal-btn[data-tab="${tabId}"]`);
    if (button) button.classList.add('active');
}

function openTab(e, tabId) {
    setActiveTab(tabId);
}

function switchNavigationTab(tabId) {
    setActiveTab(tabId);
}

function showNewestBillTab() {
    switchNavigationTab('legislations');
    return getNewestBillSummary();
}

function showNewestDecreeTab() {
    switchNavigationTab('decree');
    return getNewestDecreeSummary();
}

function getTypeHTML(type) {
    return `<span class="type-${(type || '').toLowerCase()}">${type || 'N/A'}</span>`;
}

function findStatusCatalogEntry(kind, statusValue) {
    const list = (statusCatalogs && statusCatalogs[kind]) || [];
    const key = String(statusValue || '').trim().toLowerCase();
    return list.find(s => String(s.value || '').trim().toLowerCase() === key) || null;
}

function getStatusBadgeStyle(kind, statusValue) {
    const entry = findStatusCatalogEntry(kind, statusValue);
    if (!entry) return '';
    const parts = [];
    if (entry.color) {
        parts.push(`color:${entry.color}`);
        parts.push(`text-shadow:0 0 2px ${entry.color}`);
    }
    if (entry.background) parts.push(`background:${entry.background}`);
    return parts.join(';');
}

function statusClassSlug(status) {
    return String(status || 'unknown')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9_-]/g, '') || 'unknown';
}

function getStatusHTML(status, kind) {
    const label = status || 'N/A';
    const slug = statusClassSlug(label);
    const style = getStatusBadgeStyle(kind || 'bills', label);
    return `<span class="status status-${slug}"${style ? ` style="${style}"` : ''}>${label}</span>`;
}

function parseNaturalDate(value) {
    if (!value) return new Date(NaN);
    if (typeof value === 'string') {
        const parts = value.trim().split('/');
        if (parts.length === 3) {
            const [m, d, y] = parts.map(n => parseInt(n, 10));
            if (!Number.isNaN(m) && !Number.isNaN(d) && !Number.isNaN(y)) {
                return new Date(y, m - 1, d);
            }
        }
    }
    return new Date(value);
}

function getNumberSuffix(value) {
    if (typeof value !== 'string') return 0;
    const match = value.trim().match(/-(\d+)$/);
    return match ? parseInt(match[1], 10) || 0 : 0;
}

function getSessionPrefix(value) {
    if (typeof value !== 'string') return '';
    return value.split('-')[0]?.trim() || '';
}

function formatSessionLabel(value) {
    const session = getSessionPrefix(value);
    if (!session) return 'Session Unknown';
    return `Session ${session}`;
}

function getClassOverrideList(value) {
    if (!value) return [];
    if (Array.isArray(value)) {
        return value.flatMap(item => getClassOverrideList(item));
    }
    return String(value)
        .split(/\s+/)
        .map(item => item.trim())
        .filter(Boolean);
}

function hasPinnedClass(value) {
    return getClassOverrideList(value).includes('pinned');
}

function getCategoryColor(category, colorMap) {
    if (!category || !colorMap) return '';
    return colorMap[category] || '';
}

function parseBorderColor(borderValue) {
    if (typeof borderValue !== 'string') return '';

    const cleaned = borderValue.trim().toLowerCase();
    const hexMatch = cleaned.match(/#[0-9a-f]{3,8}/i);
    if (hexMatch) return hexMatch[0];

    const rgbMatch = cleaned.match(/rgba?\([^)]*\)/i);
    if (rgbMatch) return rgbMatch[0];

    const tokens = cleaned.split(/\s+/).filter(Boolean);
    const ignored = new Set(['solid', 'dashed', 'dotted', 'double', 'inset', 'outset', 'ridge', 'none', 'hidden', 'thin', 'medium', 'thick']);
    const colorTokens = tokens.filter(token => {
        if (ignored.has(token)) return false;
        if (/^(\d+px|\d+em|\d+rem|\d+\.\d+(px|em|rem))$/.test(token)) return false;
        return true;
    });

    return colorTokens[colorTokens.length - 1] || '';
}

const DEFAULT_STROKE_WIDTH = 1.75;

function matchKey(value) {
    return String(value ?? '').trim().toLowerCase();
}

function matchesCI(a, b) {
    return matchKey(a) === matchKey(b);
}

function parseBorderWidth(borderValue) {
    if (typeof borderValue !== 'string') return null;
    const m = borderValue.trim().match(/(\d+(?:\.\d+)?)\s*px/i);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
}

function normalizeStrokeWidth(value, fallback) {
    const fb = fallback === undefined ? DEFAULT_STROKE_WIDTH : fallback;
    if (value === '' || value === null || value === undefined) return fb;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return fb;
    return n;
}

function syncCoalitionPartyStrokes() {
    const coalitionMembers = new Set();

    coalitions.forEach(coalition => {
        const strokeColor = parseBorderColor(coalition?.border) || coalition?.color || '';
        if (!strokeColor) return;

        const fromBorder = parseBorderWidth(coalition?.border);
        const width = normalizeStrokeWidth(
            coalition?.strokeWidth,
            fromBorder !== null ? fromBorder : DEFAULT_STROKE_WIDTH
        );

        const partyRefs = Array.isArray(coalition?.parties) ? coalition.parties : [];
        partyRefs.forEach(ref => {
            const partyName = typeof ref === 'string' ? ref : ref?.name;
            const party = parties.find(p => matchesCI(p?.name, partyName));
            if (party) {
                party.stroke = strokeColor;
                party.strokeWidth = width;
                coalitionMembers.add(matchKey(party.name));
            }
        });
    });

    parties.forEach(party => {
        if (!party || typeof party !== 'object') return;
        if (coalitionMembers.has(matchKey(party.name))) return;
        party.strokeWidth = normalizeStrokeWidth(party.strokeWidth, DEFAULT_STROKE_WIDTH);
    });
}

function getNewestItem(items) {
    if (!Array.isArray(items) || !items.length) return null;
    return items.reduce((latest, item) => {
        if (!item || !item.date) return latest;
        if (!latest) return item;
        const latestDate = parseNaturalDate(latest.date);
        const itemDate = parseNaturalDate(item.date);
        return itemDate > latestDate ? item : latest;
    }, null);
}

function getNewestDecreeItem(items) {
    if (!Array.isArray(items) || !items.length) return null;

    let newest = null;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item || !item.date) continue;

        const itemDate = parseNaturalDate(item.date);
        if (Number.isNaN(itemDate.getTime())) continue;

        if (!newest) {
            newest = item;
            continue;
        }

        const newestDate = parseNaturalDate(newest.date);
        if (itemDate > newestDate) {
            newest = item;
        } else if (itemDate.getTime() === newestDate.getTime()) {
            const newestSuffix = getNumberSuffix(newest.number);
            const itemSuffix = getNumberSuffix(item.number);
            if (itemSuffix > newestSuffix) newest = item;
        }
    }

    return newest;
}

function getNewestBill() {
    return getNewestItem(bills);
}

function getNewestDecree() {
    return getNewestDecreeItem(decrees);
}

function getNewestBillTitle() {
    return getNewestBill()?.title || null;
}

function getNewestDecreeTitle() {
    return getNewestDecree()?.title || null;
}

function getNewestBillSummary() {
    const bill = getNewestBill();
    return bill ? {
        title: bill.title || 'Untitled Bill',
        type: bill.type || 'Unknown',
        status: bill.status || 'Unknown',
        date: bill.date || 'Unknown',
        link: bill.link?.trim() || null
    } : null;
}

function getNewestDecreeSummary() {
    const decree = getNewestDecree();
    if (!decree) return null;

    const { resolvedStatus } = getDecreeExpiry(decree);

    return {
        title: decree.title || 'Untitled Decree',
        category: decree.category || 'General',
        status: resolvedStatus || decree.status || 'Unknown',
        date: decree.date || 'Unknown'
    };
}

function updateLatestEntries() {
    if (dom.newestBill) {
        const summary = getNewestBillSummary();
        dom.newestBill.innerHTML = '';
        dom.newestBill.style.cursor = 'pointer';
        dom.newestBill.onclick = () => showNewestBillTab();

        if (summary) {
            const titleSpan = document.createElement('span');
            titleSpan.textContent = summary.title;

            const metaSpan = document.createElement('span');
            metaSpan.className = 'wn-text-mono';
            metaSpan.style.display = 'block';
            metaSpan.style.fontSize = '11px';
            metaSpan.style.color = '#9a9aa8';
            metaSpan.style.textTransform = 'uppercase';
            metaSpan.textContent = `${summary.type} Â· ${summary.status}`;

            dom.newestBill.appendChild(titleSpan);
            dom.newestBill.appendChild(metaSpan);

            if (summary.link) {
                const linkAnchor = document.createElement('a');
                linkAnchor.href = summary.link;
                linkAnchor.target = '_blank';
                linkAnchor.rel = 'noopener';
                linkAnchor.textContent = 'source';
                linkAnchor.style.cssText = 'margin-left:8px;color:var(--wn-accent);font-size:11px;text-decoration:none;';
                linkAnchor.addEventListener('click', e => e.stopPropagation());

                metaSpan.appendChild(document.createTextNode(' '));
                metaSpan.appendChild(linkAnchor);
            }
        } else {
            dom.newestBill.textContent = 'No latest legislation';
            dom.newestBill.style.cursor = 'default';
            dom.newestBill.onclick = null;
        }
    }

    if (dom.newestDecree) {
        const summary = getNewestDecreeSummary();
        dom.newestDecree.innerHTML = '';
        dom.newestDecree.style.cursor = 'pointer';
        dom.newestDecree.onclick = () => showNewestDecreeTab();

        if (summary) {
            const titleSpan = document.createElement('span');
            titleSpan.textContent = summary.title;

            const metaSpan = document.createElement('span');
            metaSpan.className = 'wn-text-mono';
            metaSpan.style.display = 'block';
            metaSpan.style.fontSize = '11px';
            metaSpan.style.color = '#9a9aa8';
            metaSpan.style.textTransform = 'uppercase';
            metaSpan.textContent = `${summary.category} Â· ${summary.status}`;

            dom.newestDecree.appendChild(titleSpan);
            dom.newestDecree.appendChild(metaSpan);
        } else {
            dom.newestDecree.textContent = 'No latest decree';
            dom.newestDecree.style.cursor = 'default';
            dom.newestDecree.onclick = null;
        }
    }
}

function renderAssemblyComposition() {
    const overseer = roster.find(m => matchesCI(m.rank, 'Overseer'));
    const chairperson = roster.find(m => matchesCI(m.rank, 'Chairperson'));

    const oSlot = $('#overseer-slot');
    if (oSlot) {
        oSlot.querySelector('h3').textContent = overseer ? overseer.name : 'VACANT';
        oSlot.querySelector('span:last-child').textContent = overseer ? overseer.cid : 'N/A';
    }

    const cSlot = $('#chairperson-slot');
    if (cSlot) {
        cSlot.querySelector('h3').textContent = chairperson ? chairperson.name : 'VACANT';
        cSlot.querySelector('span:last-child').textContent = chairperson ? chairperson.cid : 'N/A';
    }
}

function renderRoster() {
    if (!dom.rosterTbody) return;
    dom.rosterTbody.innerHTML = '';

    const frag = document.createDocumentFragment();

    const visibleMembers = roster.filter(member => !matchesCI(member.rank, 'Overseer'));

    visibleMembers.forEach(member => {
        const tr = document.createElement('tr');
        if (matchesCI(member.rank, 'Chairperson')) tr.classList.add('chairperson-row');

        const col = member.partyColor
            || partyColorMap[member.party]
            || (parties.find(p => matchesCI(p.name, member.party)) || {}).color
            || '#888';
        const partyHTML = member.party
            ? `<span style="color:${col}">●</span> ${member.party}`
            : '<span style="color:#666;font-style:italic;"></span>';

        tr.innerHTML = `
            <td>${member.rank}</td>
            <td class="wn-text-mono" style="font-size:12px;">${member.cid}</td>
            <td>${member.name}</td>
            <td>${partyHTML}</td>
        `;
        frag.appendChild(tr);
    });

    dom.rosterTbody.appendChild(frag);
}

function renderPartyLegend() {
    if (!dom.partyLegend) return;
    dom.partyLegend.innerHTML = '';

    parties.filter(p => {
        const s = Number(p.seats);
        return Number.isFinite(s) && s > 0;
    }).forEach(p => {
        const el = document.createElement('div');
        el.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:13px;';
        el.innerHTML = `
        <span style="width:11px;height:11px;border-radius:50%;background:${p.color};flex-shrink:0;"></span>
        <span>${p.name}</span>
    `;
        dom.partyLegend.appendChild(el);
    });
}

function renderPartyBoxes() {
    if (!dom.partyBoxes) return;
    dom.partyBoxes.innerHTML = '';

    parties.filter(p => {
        const s = Number(p.seats);
        return Number.isFinite(s) && s > 0;
    }).forEach(p => {
        const item = document.createElement('div');
        item.className = 'ly-tier-item';
        const descriptionHTML = p.description
            ? `<div class="ly-tier-desc" style="padding-top:10px;">${p.description}</div>`
            : '';
        item.innerHTML = `
        <div class="display-flex" style="flex:1;align-items:center;width:100%;">
            <img src="${p.logo || defaultLogo}" alt="${p.name}"
                    style="min-width:48px;max-width:48px;max-height:48px;object-fit:contain;flex-shrink:0;">
            <div style="flex-grow:1;min-width:0;">
                <div class="display-flex" style="justify-content:space-between;align-items:center;width:100%;">
                    <span class="ly-tier-name"><strong>${p.name}</strong></span>
                    <span class="wn-text-mono" style="color:${p.color};flex-shrink:0;font-size:13px;">
                        ${p.seats} ${p.seats === 1 ? 'Seat' : 'Seats'}
                    </span>
                </div>
            </div>
        </div>
        ${descriptionHTML}
    `;
        dom.partyBoxes.appendChild(item);
    });
}

function getAssignedSeatCount() {
    return parties.reduce((sum, party) => sum + (Number(party.seats) || 0), 0);
}

function getResolvedTotalSeats() {
    const assignedSeats = getAssignedSeatCount();
    const configured = Number(totalSeats);
    if (Number.isFinite(configured) && configured > 0) {
        return Math.floor(configured);
    }
    return assignedSeats;
}

function getDisplaySeatTotal() {
    const configured = Number(displaySeatCount);
    if (Number.isFinite(configured) && configured > 0) {
        return Math.floor(configured);
    }
    return getResolvedTotalSeats();
}

function formatSeatCountLabel() {
    const assignedSeats = getAssignedSeatCount();
    const displayTotal = getDisplaySeatTotal();

    if (showSeatFraction && assignedSeats < displayTotal) {
        return `${assignedSeats}/${displayTotal}`;
    }
    return String(displayTotal);
}

function renderSeatCount() {
    const displayValue = formatSeatCountLabel();

    if (dom.districtSeatCount) {
        dom.districtSeatCount.textContent = displayValue;
    }

    if (dom.seatCountText) {
        dom.seatCountText.textContent = displayValue;
    }
}

const ARCH_ROW_TOTALS = [
    3, 15, 33, 61, 95, 138, 189, 247, 313, 388, 469, 559, 657, 762, 876, 997,
    1126, 1263, 1408, 1560, 1722, 1889, 2066, 2250, 2442, 2641, 2850, 3064,
    3289, 3519, 3759, 4005, 4261, 4522, 4794, 5071, 5358, 5652, 5953, 6263,
    6581, 6906, 7239, 7581, 7929, 8287, 8650, 9024, 9404, 9793, 10187, 10594,
    11003, 11425, 11850, 12288, 12729, 13183, 13638, 14109, 14580, 15066, 15553,
    16055, 16557, 17075, 17592, 18126, 18660, 19208, 19758, 20323, 20888, 21468,
    22050, 22645, 23243, 23853, 24467, 25094, 25723, 26364, 27011, 27667, 28329,
    29001, 29679, 30367, 31061
];
function computeArchSeatLayout(seatTotal, useDenseRows) {
    const totalSeatsN = Math.max(0, Math.floor(Number(seatTotal) || 0));
    if (totalSeatsN <= 0) {
        return { positions: [], circleRadius: 0, rowCount: 0 };
    }

    let rowCount = ARCH_ROW_TOTALS.findIndex(el => el >= totalSeatsN) + 1;
    if (rowCount <= 0) {
        rowCount = ARCH_ROW_TOTALS.length;
    }

    const circleRadius = 0.4 / rowCount;

    function optimiseRows() {
        let handledSpots = 0;
        for (let i = rowCount; i > 0; i--) {
            const magicNumber = 3 * rowCount + 4 * i - 2;
            const maximumSeatsInRow = Math.PI / (2 * Math.asin(2 / magicNumber));
            handledSpots += Math.trunc(maximumSeatsInRow);

            if (handledSpots >= totalSeatsN) {
                const wastedRows = i - 1;
                const diagramFullness = totalSeatsN / handledSpots;
                return [wastedRows, diagramFullness];
            }
        }
        return [0, 0];
    }

    function appendSeatPositions(positions, seatsInRow, rowRadius) {
        const ratio = Math.sin(circleRadius / rowRadius);
        for (let i = 0; i < seatsInRow; i++) {
            let angle = 0;
            if (seatsInRow == 1) {
                angle = Math.PI / 2;
            } else {
                angle = i
                    * (Math.PI - 2 * ratio)
                    / (seatsInRow - 1)
                    + ratio;
            }
            positions.push({
                angle: angle,
                x: rowRadius * Math.cos(angle) + 1.75,
                y: rowRadius * Math.sin(angle)
            });
        }
        return positions;
    }

    function appendRowSeats(positions, index, diagramFullness) {
        const magicNumber = 3.0 * rowCount + 4.0 * index - 2.0;
        const maximumSeatsInRow = Math.PI / (2 * Math.asin(2.0 / magicNumber));

        const seatsInCurrentRow = Math.trunc(diagramFullness * maximumSeatsInRow);

        const currentRowRadius = magicNumber / (4.0 * rowCount);
        return appendSeatPositions(positions, seatsInCurrentRow, currentRowRadius);
    }

    function appendFinalSeats(positions) {
        const leftoverSeats = totalSeatsN - positions.length;
        const finalRowRadius = (7 * rowCount - 2) / (4 * rowCount);
        return appendSeatPositions(positions, leftoverSeats, finalRowRadius);
    }

    let discardRows = 0;
    let diagramFullness = 0;

    if (useDenseRows) {
        [discardRows, diagramFullness] = optimiseRows();
    } else {
        diagramFullness = totalSeatsN / ARCH_ROW_TOTALS[rowCount - 1];
    }

    let positions = [];
    for (let i = discardRows + 1; i < rowCount; i++) {
        positions = appendRowSeats(positions, i, diagramFullness);
    }
    positions = appendFinalSeats(positions);

    positions.sort((left, right) => {
        const cmpAngle = right.angle - left.angle;
        if (cmpAngle == 0) {
            const cmpX = right.x - left.x;
            if (cmpX == 0) return right.y - left.y;
            return cmpX;
        }
        return cmpAngle;
    });

    if (positions.length > totalSeatsN) {
        positions = positions.slice(0, totalSeatsN);
    } else if (positions.length < totalSeatsN) {
        const finalRowRadius = (7 * rowCount - 2) / (4 * rowCount);
        positions = appendSeatPositions(positions, totalSeatsN - positions.length, finalRowRadius);
        positions.sort((left, right) => {
            const cmpAngle = right.angle - left.angle;
            if (cmpAngle == 0) {
                const cmpX = right.x - left.x;
                if (cmpX == 0) return right.y - left.y;
                return cmpX;
            }
            return cmpAngle;
        });
        if (positions.length > totalSeatsN) {
            positions = positions.slice(0, totalSeatsN);
        }
    }

    return { positions, circleRadius, rowCount };
}

function buildSeatCircles(count) {
    const seatsGroup = dom.seatMap.querySelector('#seats');
    if (!seatsGroup) return [];

    seatsGroup.innerHTML = '';
    const n = Math.max(0, Math.floor(Number(count) || 0));
    if (n <= 0) return [];

    const { positions, circleRadius } = computeArchSeatLayout(n, Boolean(denseRows));
    const radiusPx = circleRadius * 100.0;
    const ns = 'http://www.w3.org/2000/svg';

    for (let i = 0; i < positions.length; i++) {
        const pos = positions[i];
        const cx = 5.0 + 100.0 * pos.x;
        const cy = 5.0 + 100.0 * (1.75 - pos.y);
        const circle = document.createElementNS(ns, 'circle');
        circle.setAttribute('cx', String(cx));
        circle.setAttribute('cy', String(cy));
        circle.setAttribute('r', String(radiusPx));
        seatsGroup.appendChild(circle);
    }

    return Array.from(seatsGroup.querySelectorAll('circle'));
}

function setupSeatMap() {
    if (!dom.seatMap) return;

    let defs = dom.seatMap.querySelector('defs');
    if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        dom.seatMap.insertBefore(defs, dom.seatMap.firstChild);
    }

    const circles = buildSeatCircles(getResolvedTotalSeats());
    const councillorNamesByParty = {};
    roster.filter(member => matchesCI(member.rank, 'Councillor')).forEach(member => {
        const key = matchKey(member.party);
        if (!key) return;
        if (!councillorNamesByParty[key]) {
            councillorNamesByParty[key] = [];
        }
        councillorNamesByParty[key].push(member.name);
    });

    let seatIdx = 0;

    parties.forEach(party => {
        const seatCount = Number(party.seats);
        if (!Number.isFinite(seatCount) || seatCount <= 0) return;

        const safe = party.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
        const gid = `grad-${safe}`;
        if (!defs.querySelector(`#${gid}`)) {
            const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
            grad.id = gid;
            grad.setAttribute('x1', '0%'); grad.setAttribute('y1', '0%');
            grad.setAttribute('x2', '0%'); grad.setAttribute('y2', '100%');
            grad.innerHTML = `
            <stop offset="0%"   stop-color="${party.color}"/>
            <stop offset="100%" stop-color="${party.color}" stop-opacity="0.6"/>
        `;
            defs.appendChild(grad);
        }
        const partyCouncillors = councillorNamesByParty[matchKey(party.name)] || [];
        const coalition = findCoalitionForParty(party.name);

        for (let i = 0; i < party.seats && seatIdx < circles.length; i++, seatIdx++) {
            const c = circles[seatIdx];
            const partyStroke = (party.stroke || '').trim();
            const councillorName = partyCouncillors[i] || '';
            c.setAttribute('fill', `url(#${gid})`);
            c.setAttribute('data-party', party.name);
            c.setAttribute('data-councillor', councillorName);
            c.setAttribute('data-color', party.color);
            if (coalition) {
                c.setAttribute('data-coalition', coalition.name);
                c.setAttribute('data-coalition-color', coalition.color || '');
            } else {
                c.removeAttribute('data-coalition');
                c.removeAttribute('data-coalition-color');
            }
            const strokeW = partyStroke
                ? normalizeStrokeWidth(party.strokeWidth, DEFAULT_STROKE_WIDTH)
                : 0;
            c.setAttribute('stroke', partyStroke || 'none');
            c.setAttribute('stroke-width', String(strokeW));
            c.setAttribute('stroke-opacity', partyStroke ? '1' : '0');
            c.style.filter = 'drop-shadow(0 0 2px rgba(0,0,0,0.12))';
            c.style.cursor = 'pointer';
            c.style.opacity = '';
        }
    });

    while (seatIdx < circles.length) {
        const c = circles[seatIdx++];
        c.setAttribute('fill', vacantColor);
        c.setAttribute('stroke', vacantStroke);
        c.setAttribute('stroke-width', '1');
        c.setAttribute('data-party', 'Vacant');
        c.removeAttribute('data-councillor');
        c.removeAttribute('data-coalition');
        c.removeAttribute('data-coalition-color');
        c.setAttribute('data-color', '#888');
        c.setAttribute('opacity', vacantOpacity);
        c.style.opacity = vacantOpacity;
        c.style.cursor = 'default';
        c.style.filter = 'none';
    }

    renderSeatCount();
    clearSeatHighlight();
    resetTooltip();

    if (dom.seatTooltip) {
        dom.seatTooltip.style.pointerEvents = 'none';
        dom.seatTooltip.style.userSelect = 'none';
    }

    circles.forEach(c => {
        c.addEventListener('click', (e) => {
            e.stopPropagation();
            handleSeatClick(c);
        });
    });
}

function findCoalitionForParty(partyName) {
    if (!partyName || matchesCI(partyName, 'Vacant')) return null;
    return (coalitions || []).find(coalition => {
        const refs = Array.isArray(coalition?.parties) ? coalition.parties : [];
        return refs.some(ref => {
            const name = typeof ref === 'string' ? ref : ref?.name;
            return matchesCI(name, partyName);
        });
    }) || null;
}

function getSeatCircles() {
    if (!dom.seatMap) return [];
    return Array.from(dom.seatMap.querySelectorAll('#seats circle'));
}

function clearSeatHighlight() {
    if (dom.seatMap) {
        dom.seatMap.classList.remove('seat-highlight-mode');
    }
    getSeatCircles().forEach(c => {
        c.classList.remove('seat-lit', 'seat-dim');
        c.style.transform = '';
        if (c.getAttribute('data-party') === 'Vacant') {
            c.style.opacity = vacantOpacity;
            c.style.filter = 'none';
        } else {
            c.style.opacity = '';
            c.style.filter = 'drop-shadow(0 0 2px rgba(0,0,0,0.12))';
        }
    });
    seatHighlight = { mode: null, key: null, focusParty: null };
}

function applySeatHighlight(isMatch) {
    if (dom.seatMap) {
        dom.seatMap.classList.add('seat-highlight-mode');
    }
    getSeatCircles().forEach(c => {
        const isVacant = c.getAttribute('data-party') === 'Vacant';
        const match = isMatch(c);
        c.classList.toggle('seat-lit', Boolean(match) && !isVacant);
        c.classList.toggle('seat-dim', !match);
        c.style.transform = '';
        c.style.opacity = '';
        if (isVacant) {
            c.style.filter = 'none';
        } else {
            c.style.filter = '';
        }
    });
}

function highlightPartySeats(partyName) {
    seatHighlight = { mode: 'party', key: partyName, focusParty: partyName };
    applySeatHighlight(c => matchesCI(c.getAttribute('data-party'), partyName));
}

function getCoalitionMemberNames(coalition) {
    return new Set(
        (Array.isArray(coalition?.parties) ? coalition.parties : [])
            .map(ref => typeof ref === 'string' ? ref : ref?.name)
            .filter(Boolean)
            .map(matchKey)
    );
}

function getActiveHighlightedCoalition() {
    if (seatHighlight.mode !== 'coalition' || !seatHighlight.key) return null;
    return (coalitions || []).find(c => c && matchesCI(c.name, seatHighlight.key)) || null;
}

function isPartyInActiveCoalition(partyName) {
    const coalition = getActiveHighlightedCoalition();
    if (!coalition) return false;
    return getCoalitionMemberNames(coalition).has(matchKey(partyName));
}

function highlightCoalitionSeats(coalition, focusParty) {
    if (!coalition) return;
    const memberNames = getCoalitionMemberNames(coalition);
    seatHighlight = {
        mode: 'coalition',
        key: coalition.name,
        focusParty: focusParty || null
    };
    applySeatHighlight(c => memberNames.has(matchKey(c.getAttribute('data-party'))));
}

function showSeatTooltip(circle) {
    if (!dom.seatTooltip) return;
    const party = circle.getAttribute('data-party');
    const color = circle.getAttribute('data-color');
    const councillor = circle.getAttribute('data-councillor');
    if (party === 'Vacant') {
        resetTooltip();
        return;
    }
    dom.seatTooltip.innerHTML =
        `<div style="font-size:12px;opacity:0.8;margin-top:3px;min-height:1.2em;">${councillor || '&nbsp;'}</div>` +
        `<div style="font-weight:600;">${party}</div>`;
    dom.seatTooltip.style.color = color || '#888';
    activeTooltipCircle = circle;
}

function showCoalitionTooltip(coalition, sourceCircle) {
    if (!dom.seatTooltip || !coalition) return;

    const party = sourceCircle?.getAttribute('data-party') || '';
    const councillor = sourceCircle?.getAttribute('data-councillor') || '';
    const partyColor = sourceCircle?.getAttribute('data-color') || '';
    const coalitionColor = coalition.color || sourceCircle?.getAttribute('data-coalition-color') || '#c5c5d6';

    dom.seatTooltip.innerHTML =
        `<div style="font-size:12px;opacity:0.8;margin-top:3px;min-height:1.2em;color:${partyColor || 'inherit'};">${councillor || '&nbsp;'}</div>` +
        `<div style="font-weight:600;color:${partyColor || 'inherit'};">${party || '-'}</div>` +
        `<div style="font-size:11px;opacity:0.85;margin-top:2px;letter-spacing:0.3px;color:${coalitionColor};">` +
        `<span style="opacity:0.75;">Coalition</span> Â· ${coalition.name}</div>`;
    dom.seatTooltip.style.color = partyColor || coalitionColor || '#c5c5d6';
    activeTooltipCircle = sourceCircle || null;
}

function resetTooltip() {
    if (!dom.seatTooltip) return;
    dom.seatTooltip.textContent = '';
    dom.seatTooltip.style.color = 'rgba(255,255,255,0.35)';
    activeTooltipCircle = null;
}

function clearSeatSelection() {
    clearSeatHighlight();
    resetTooltip();
}

function handleSeatClick(circle) {
    const party = circle.getAttribute('data-party');
    if (!party || matchesCI(party, 'Vacant')) {
        clearSeatSelection();
        return;
    }

    if (seatHighlight.mode === 'coalition') {
        if (isPartyInActiveCoalition(party)) {
            if (matchesCI(seatHighlight.focusParty, party)) {
                clearSeatSelection();
                return;
            }
            seatHighlight.focusParty = party;
            const activeCoalition = getActiveHighlightedCoalition();
            if (activeCoalition) {
                showCoalitionTooltip(activeCoalition, circle);
            }
            return;
        }
        highlightPartySeats(party);
        showSeatTooltip(circle);
        return;
    }

    if (seatHighlight.mode === 'party' && matchesCI(seatHighlight.key, party)) {
        const coalition = findCoalitionForParty(party);
        if (coalition) {
            highlightCoalitionSeats(coalition, party);
            showCoalitionTooltip(coalition, circle);
        } else {
            clearSeatSelection();
        }
        return;
    }

    highlightPartySeats(party);
    showSeatTooltip(circle);
}

function formatDuration(ms, isPast) {
    const totalMins = Math.floor(ms / 60000);
    const totalHours = Math.floor(totalMins / 60);
    const totalDays = Math.floor(totalHours / 24);
    const totalMonths = Math.floor(totalDays / 30);

    if (!isPast) {
        if (ms < 3_600_000) return '< 1 hour';
        if (totalDays === 0) {
            const remMins = totalMins - totalHours * 60;
            return remMins > 0 ? `${totalHours}h ${remMins}m` : `${totalHours}h`;
        }
        if (totalMonths >= 1) {
            const remDays = totalDays - totalMonths * 30;
            return remDays > 0
                ? `${totalMonths} month${totalMonths > 1 ? 's' : ''}, ${remDays} day${remDays !== 1 ? 's' : ''}`
                : `${totalMonths} month${totalMonths > 1 ? 's' : ''}`;
        }
        return `${totalDays} day${totalDays !== 1 ? 's' : ''}`;
    } else {
        if (totalDays === 0) {
            if (totalHours >= 1) {
                const remMins = totalMins - totalHours * 60;
                return remMins > 0 ? `${totalHours}h ${remMins}m` : `${totalHours}h`;
            }
            return totalMins >= 1 ? `${totalMins}m` : '< 1 min';
        }
        if (totalMonths >= 1) {
            const remDays = totalDays - totalMonths * 30;
            return remDays > 0
                ? `${totalMonths} month${totalMonths > 1 ? 's' : ''}, ${remDays} day${remDays !== 1 ? 's' : ''}`
                : `${totalMonths} month${totalMonths > 1 ? 's' : ''}`;
        }
        return `${totalDays} day${totalDays !== 1 ? 's' : ''}`;
    }
}

function getDecreeExpiry(d) {
    const statusKey = String(d.status || '').trim().toLowerCase();
    const skipByDecree = d.skipExpiry === true;
    const skipByStatus = getDecreeSkipExpiryStatuses().includes(statusKey);
    if (skipByDecree || skipByStatus) {
        return { resolvedStatus: d.status, labelSuffix: '' };
    }
    if (!d.expiresAt) return { resolvedStatus: d.status, labelSuffix: '' };

    const expiresAt = new Date(d.expiresAt);
    if (isNaN(expiresAt)) return { resolvedStatus: d.status, labelSuffix: '' };

    const diff = expiresAt - PAGE_LOAD_TIME;

    if (diff <= 0) {
        const agoStr = formatDuration(PAGE_LOAD_TIME - expiresAt, true);
        return {
            resolvedStatus: 'expired',
            labelSuffix: ` Â· Expired ${agoStr} ago`,
        };
    }

    const resolvedStatus = d.status === 'expired' ? 'active' : d.status;
    const countStr = formatDuration(diff, false);
    return {
        resolvedStatus,
        labelSuffix: ` Â· Expires in ${countStr}`,
    };
}

function renderDecrees() {
    if (!dom.decreesContent) return;
    dom.decreesContent.innerHTML = '';

    const COLLAPSE_HEIGHT = 100;

    const createDecreeCard = (d) => {
        const { resolvedStatus, labelSuffix } = getDecreeExpiry(d);
        const card = document.createElement('div');
        const overrideClasses = getClassOverrideList(d.classOverride);
        card.className = ['ly-tier-banner', ...overrideClasses].join(' ');
        card.style.cssText = 'margin-bottom: 20px; position: relative; overflow: hidden;';

        const issuedByString = [d.role, d.name].filter(Boolean).join(' ') || 'Overwatch';
        const isPinned = hasPinnedClass(d.classOverride);
        const pinnedBadge = isPinned
            ? '<span class="status status-pinned" style="color:#f5a7b0;background:rgba(197,34,55,0.2);">Pinned</span>'
            : '';

        card.innerHTML = `
            <div class="ly-tier-banner-header">
                <div style="flex:1;">
                    <div class="ly-tier-label">${d.number || 'N/A'} · ${d.category || 'N/A'} · ${d.date || 'N/A'}${labelSuffix}</div>
                    <div class="ly-tier-title">${d.title || 'Untitled Decree'}</div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
                    ${getStatusHTML(resolvedStatus || 'N/A', 'decrees')}
                    ${pinnedBadge}
                </div>
            </div>
            <div class="ly-tier-banner-body">
                <div style="margin-bottom:10px;">
                    <span class="wn-eyebrow">Issued By</span>
                    <p style="margin:4px 0 0;font-family:'Share Tech Mono',monospace;font-size:12px;color:rgba(255,255,255,0.55);">${issuedByString}</p>
                </div>
                <hr style="margin:8px 0;">
                <div class="decree-desc-wrapper collapsed" style="max-height: ${COLLAPSE_HEIGHT}px; overflow: hidden; position: relative; padding-bottom: 44px; transition: max-height 180ms ease;">
                    <div class="decree-desc-content" style="margin:0; font-size:13.5px; line-height:1.7;">
                        ${d.description || `<i style="opacity: 0.4;">No description provided.</i>`}
                    </div>
                    <div class="decree-fade-overlay" style="position:absolute; inset:auto 0 0 0; height:200px; background:linear-gradient(to bottom, rgba(22, 22, 34, 0), rgba(22, 22, 34,1)); pointer-events:none; z-index:1;"></div>
                    <button class="decree-toggle-btn" style="position:absolute; bottom:10px; left:50%; transform:translateX(-50%); z-index:2; pointer-events:auto;">Expand</button>
                </div>
                <span class="decree-stamp">${d.category || ''}</span>
            </div>
        `;

        const wrapper = card.querySelector('.decree-desc-wrapper');
        const content = card.querySelector('.decree-desc-content');
        const fade = card.querySelector('.decree-fade-overlay');
        const toggleBtn = card.querySelector('.decree-toggle-btn');

        if (!wrapper || !content || !fade || !toggleBtn) return card;

        const hasDescriptionContent = !!(content && content.textContent && content.textContent.trim());

        if (!hasDescriptionContent) {
            wrapper.classList.remove('collapsed');
            wrapper.style.maxHeight = 'none';
            fade.style.display = 'none';
            toggleBtn.style.display = 'none';
            return card;
        }

        let isExpanded = false;

        const updateState = () => {
            if (isExpanded) {
                wrapper.classList.remove('collapsed');
                wrapper.style.maxHeight = `${content.scrollHeight}px`;
                fade.style.opacity = '0';
                fade.style.pointerEvents = 'none';

                toggleBtn.textContent = 'Minimize';
                toggleBtn.style.position = 'static';
                toggleBtn.style.transform = 'none';
                toggleBtn.style.margin = '10px auto 0';
                toggleBtn.style.display = 'block';
            } else {
                wrapper.classList.add('collapsed');
                wrapper.style.maxHeight = `${COLLAPSE_HEIGHT}px`;
                fade.style.opacity = '1';
                fade.style.pointerEvents = 'none';

                toggleBtn.textContent = 'Expand';
                toggleBtn.style.position = 'absolute';
                toggleBtn.style.bottom = '10px';
                toggleBtn.style.left = '50%';
                toggleBtn.style.transform = 'translateX(-50%)';
                toggleBtn.style.margin = '0';
                toggleBtn.style.display = 'block';
            }
        };

        const observer = new ResizeObserver(() => {
            if (content.scrollHeight === 0) return;

            if (content.scrollHeight > COLLAPSE_HEIGHT + 25) {
                updateState();
                toggleBtn.addEventListener('click', () => {
                    isExpanded = !isExpanded;
                    updateState();
                });
            } else {
                wrapper.classList.remove('collapsed');
                wrapper.style.maxHeight = 'none';
                fade.style.display = 'none';
                toggleBtn.style.display = 'none';
            }

            observer.disconnect();
        });

        observer.observe(content);
        return card;
    };

    const renderDecreeCard = (d) => {
        const card = createDecreeCard(d);
        dom.decreesContent.appendChild(card);
    };

    const pinnedDecrees = decrees.filter(d => hasPinnedClass(d.classOverride));
    const regularDecrees = decrees.filter(d => !hasPinnedClass(d.classOverride));

    if (pinnedDecrees.length) {
        const section = document.createElement('section');
        section.style.marginBottom = '24px';

        const title = document.createElement('div');
        title.className = 'dynamic-section-title';
        title.textContent = 'Pinned Decrees';
        title.style.color = '#c52237';
        section.appendChild(title);

        pinnedDecrees.forEach(d => {
            const card = createDecreeCard(d);
            card.style.marginBottom = '16px';
            section.appendChild(card);
        });

        dom.decreesContent.appendChild(section);
    }

    if (pinnedDecrees.length && regularDecrees.length) {
        const separator = document.createElement('hr');
        separator.style.cssText = 'border: none; border-top: 2px dashed var(--wn-accent); margin: 24px 0; opacity: 0.6;';
        dom.decreesContent.appendChild(separator);
    }

    const sessionGroups = {};
    regularDecrees.forEach(d => {
        const session = getSessionPrefix(d.number);
        if (!sessionGroups[session]) sessionGroups[session] = [];
        sessionGroups[session].push(d);
    });

    Object.keys(sessionGroups).forEach(session => {
        sessionGroups[session].sort((a, b) => {
            const dateA = parseNaturalDate(a.date);
            const dateB = parseNaturalDate(b.date);
            if (dateA > dateB) return -1;
            if (dateA < dateB) return 1;
            return getNumberSuffix(b.number) - getNumberSuffix(a.number);
        });
    });

    const sessionOrder = Object.keys(sessionGroups).sort((sessionA, sessionB) => {
        const numA = parseInt(sessionA, 10);
        const numB = parseInt(sessionB, 10);

        const isANan = isNaN(numA);
        const isBNan = isNaN(numB);

        if (!isANan && !isBNan) {
            return numB - numA;
        }

        if (!isANan && isBNan) return -1;
        if (isANan && !isBNan) return 1;

        return sessionA.localeCompare(sessionB);
    });

    sessionOrder.forEach((session, sessionIdx) => {
        if (sessionIdx > 0) {
            const separator = document.createElement('hr');
            separator.style.cssText = 'border: none; border-top: 2px dashed var(--wn-accent); margin: 24px 0; opacity: 0.6;';
            dom.decreesContent.appendChild(separator);
        }

        const sessionHeader = document.createElement('div');
        sessionHeader.className = 'dynamic-section-title';
        sessionHeader.textContent = formatSessionLabel(session);
        sessionHeader.style.color = 'var(--wn-accent)';
        dom.decreesContent.appendChild(sessionHeader);

        sessionGroups[session].forEach(renderDecreeCard);
    });
}

function renderCommittees() {
    if (!dom.committeesContent) return;
    dom.committeesContent.innerHTML = '';

    const categories = [...new Set(committees.map(c => c.category || 'General'))];

    if (!committees.length) {
        dom.committeesContent.innerHTML = '<h3 style="text-align:center;color:#6a6a7a;">No committees on record.</h3>';
        return;
    }

    categories.forEach(category => {
        const section = document.createElement('section');
        section.style.marginBottom = '24px';

        const categoryCommittees = [...committees.filter(c => (c.category || 'General') === category)]
            .sort((a, b) => Number(hasPinnedClass(b.classOverride)) - Number(hasPinnedClass(a.classOverride)));
        const sectionColor = getCategoryColor(category, committeeCategoryColors);

        const title = document.createElement('div');
        title.className = 'dynamic-section-title';
        title.textContent = category;
        if (sectionColor) {
            title.style.color = sectionColor;
        }
        section.appendChild(title);

        categoryCommittees.forEach(committee => {
            const card = document.createElement('div');
            const overrideClasses = getClassOverrideList(committee.classOverride);
            card.className = ['ly-tier-banner', ...overrideClasses].join(' ');
            card.style.marginBottom = '16px';

            const membersMarkup = (committee.members || [])
                .map(member => `<span class="member-pill ${member.chair ? 'chair' : ''}">${member.name || 'Name'}</span>`)
                .join('');
            const isPinned = hasPinnedClass(committee.classOverride);
            const pinnedBadge = isPinned
                ? '<span class="status status-pinned" style="color:#f5a7b0;background:rgba(197,34,55,0.2);">Pinned</span>'
                : '';

            card.innerHTML = `
                <div class="ly-tier-banner-header">
                    <div style="flex:1;">
                        <div class="ly-tier-label">${committee.category || 'Committee'} · ${committee.date ?
                    `Est. ${committee.date}` : '<span style="opacity: 0.6;">Permanent</span>'}</div>
                        <div class="ly-tier-title">${committee.title || 'Untitled Committee'}</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
                        ${getStatusHTML(committee.status || 'inactive', 'committees')}
                        ${pinnedBadge}
                    </div>
                </div>
                <div class="ly-tier-banner-body">
                    <p style="margin-bottom:14px;">${committee.description || 'Description'}</p>
                    <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:12px;">
                        <span class="wn-eyebrow" style="display:block;margin-bottom:8px;">Members</span>
                        <div>${membersMarkup || '<span class="member-pill">No members listed</span>'}</div>
                    </div>
                </div>
            `;

            section.appendChild(card);
        });

        dom.committeesContent.appendChild(section);
    });

    checkCommitteesContent();
    renderCommitteeCount();
}

function checkCommitteesContent() {
    if (!dom.committeesContent) return;
    const committeeCards = dom.committeesContent.querySelectorAll('.ly-tier-banner');
    if (committeeCards.length === 0) {
        dom.committeesContent.innerHTML = '<h3 style="text-align:center;color:#6a6a7a;">No committees on record.</h3>';
    }
}

function checkDecreesContent() {
    if (!dom.decreesContent) return;
    const decreeCards = dom.decreesContent.querySelectorAll('.ly-tier-banner');
    if (decreeCards.length === 0) {
        dom.decreesContent.innerHTML = '<h3 style="text-align:center;color:#6a6a7a;">No decrees on record.</h3>';
    }
}

function preprocessBills() {
    bills.forEach(b => {
        b._sortNumber = parseInt(b.number, 10) || 0;
        b._sortDate = new Date(b.date);
    });
}

function getFilteredBills() {
    const key = JSON.stringify({
        tags: [...selectedTags].sort(),
        statuses: [...selectedStatuses].sort(),
        types: [...selectedTypes].sort(),
    });

    if (key === lastFilterKey) return cachedFilteredBills;
    lastFilterKey = key;

    cachedFilteredBills = bills.filter(b => {
        const tagOk = !selectedTags.length || selectedTags.every(t => b.tags?.includes(t));
        const statusOk = !selectedStatuses.length || selectedStatuses.includes(b.status);
        const typeOk = !selectedTypes.length || selectedTypes.includes(b.type);
        return tagOk && statusOk && typeOk;
    });

    return cachedFilteredBills;
}

function toggleControlDrawer() {
    if (!dom.controlDrawer || !dom.drawerCaret) return;
    const open = dom.controlDrawer.classList.toggle('open');
    dom.drawerCaret.textContent = open ? 'â–²' : 'â–¼';
}

function handleGroupingToggle(mode) {
    activeViewMode = (activeViewMode === mode) ? "none" : mode;
    $$('.view-mode-container .mode-toggle-btn').forEach(b => b.classList.remove('active'));
    if (activeViewMode !== "none") {
        const btn = $(`#mode-${activeViewMode}`);
        if (btn) btn.classList.add('active');
    }
    renderBills();
}

function handleSortToggle(field) {
    if (currentSortField === field) {
        if (field === 'type' || field === 'status') {
            currentSortField = null; isAscending = true;
        } else {
            if (isAscending) { isAscending = false; }
            else { currentSortField = null; isAscending = true; }
        }
    } else {
        currentSortField = field; isAscending = true;
    }
    renderBills();
}

function updateSortUIIndicators() {
    $$('.sort-link').forEach(link => {
        link.classList.remove('active');
        const d = link.querySelector('.dir');
        if (d) d.textContent = '';
    });
    if (currentSortField) {
        const lnk = $(`#sort-${currentSortField}`);
        if (lnk) {
            lnk.classList.add('active');
            const d = lnk.querySelector('.dir');
            if (d && (currentSortField === 'number' || currentSortField === 'date'))
                d.textContent = isAscending ? ' â–²' : ' â–¼';
        }
    }
}

function buildFilterClouds() {
    const tagSet = new Set(), statusSet = new Set(), typeSet = new Set();
    bills.forEach(b => {
        if (b.status) statusSet.add(b.status);
        if (b.type) typeSet.add(b.type);
        if (b.tags) b.tags.forEach(t => { if (t?.trim() && t.toUpperCase() !== 'N/A') tagSet.add(t.trim()); });
    });

    generateCloud(dom.statusCloud, [...statusSet].sort(), selectedStatuses);
    generateCloud(dom.typeCloud, [...typeSet].sort(), selectedTypes);
    generateCloud(dom.tagCloud, [...tagSet].sort(), selectedTags);
}

function generateCloud(container, items, arr) {
    if (!container) return;
    container.innerHTML = '';

    items.forEach(item => {
        const pill = document.createElement('span');
        pill.className = 'interactive-pill';
        pill.textContent = item;

        if (arr.includes(item)) pill.classList.add('selected');

        pill.addEventListener('click', () => {
            const i = arr.indexOf(item);
            if (i > -1) arr.splice(i, 1); else arr.push(item);
            pill.classList.toggle('selected');
            lastFilterKey = '';
            renderBills();
        });

        container.appendChild(pill);
    });
}

function renderBills() {
    if (!dom.dynamicContainer) return;
    const data = getFilteredBills();
    dom.dynamicContainer.innerHTML = '';

    if (!data.length) {
        dom.dynamicContainer.innerHTML = `
        <h3 style = "text-align:center;color:#6a6a7a;"><br>No legislation on record.</h3>`;
        updateSortUIIndicators();
        return;
    }

    const groups = {};
    if (activeViewMode === "none") {
        groups["All Bills Cluster"] = [...data];
    } else {
        data.forEach(b => {
            const k = b[activeViewMode] || "UNASSIGNED";
            if (!groups[k]) groups[k] = [];
            groups[k].push(b);
        });
    }

    Object.keys(groups)
        .sort((a, b) => activeViewMode === 'session' ? b.localeCompare(a) : a.localeCompare(b))
        .forEach(groupKey => {
            let items = groups[groupKey];
            if (currentSortField) {
                items = [...items].sort((a, b) => {
                    if (currentSortField === 'number') return isAscending ? a._sortNumber - b._sortNumber : b._sortNumber - a._sortNumber;
                    if (currentSortField === 'date') return isAscending ? a._sortDate - b._sortDate : b._sortDate - a._sortDate;
                    const va = a[currentSortField] || '', vb = b[currentSortField] || '';
                    return isAscending ? va.localeCompare(vb) : vb.localeCompare(va);
                });
            }

            const block = document.createElement('div');
            block.className = 'ly-tier-banner';
            block.style.marginBottom = '30px';
            block.innerHTML = `
                    <div class="ly-tier-banner-header">
                        <div>
                            <div class="ly-tier-label">${activeViewMode === "none" ? "All Legislation" : activeViewMode}</div>
                            <div class="ly-tier-title">${activeViewMode === "none" ? "General Records" : groupKey}</div>
                        </div>
                    </div>
                    <div class="ly-tier-banner-body" style="padding: 0;">
                        <table class="wn-table-striped legislation-table" style="margin: 0; width: 100%;">
                            <thead>
                                <tr>
                                    <th style="width: 70px; text-align: center;">No.</th>
                                    <th>Title</th>
                                    <th style="width: 110px;">Type</th>
                                    <th style="width: 110px; text-align: center;">Status</th>
                                    <th style="width: 95px; text-align: center;">Date</th>
                                </tr>
                            </thead>
                            <tbody style="color: #c5c5d6;"></tbody>
                        </table>
                    </div>
                `;

            const tbody = block.querySelector('tbody');
            const frag = document.createDocumentFragment();

            items.forEach(bill => {
                const row = document.createElement('tr');
                row.style.cursor = 'pointer';
                row.innerHTML = `
                    <td class="wn-text-mono" style="text-align: center; font-size: 13px;">${bill.number || 'N/A'}</td>
                    <td style="font-weight: 500; color: inherit;">${bill.title || 'N/A'}</td>
                    <td>${getTypeHTML(bill.type || 'N/A')}</td>
                    <td style="text-align: center;">${getStatusHTML(bill.status || 'N/A', 'bills')}</td>
                    <td class="wn-text-mono" style="text-align: center; font-size: 13px;">${bill.date || 'N/A'}</td>
                `;
                row.addEventListener('click', () => showBillDetails(bill));
                frag.appendChild(row);
            });

            tbody.appendChild(frag);
            dom.dynamicContainer.appendChild(block);
        });

    updateSortUIIndicators();
}

function showBillDetails(bill) {
    if (!dom.billModal) return;

    dom.modalNumber.textContent = `Bill ${bill.number || 'N/A'} Â· Session ${bill.session || 'N/A'} Â· ${bill.type || 'N/A'}`;
    dom.modalTitle.textContent = bill.title || 'Untitled Bill';
    dom.modalType.innerHTML = getTypeHTML(bill.type || 'N/A');
    dom.modalStatus.innerHTML = getStatusHTML(bill.status || 'N/A', 'bills');
    const sponsors = Array.isArray(bill.sponsors)
        ? bill.sponsors.map(s => typeof s === 'string' ? s.trim() : '').filter(Boolean)
        : Array.isArray(bill.sponsor)
            ? bill.sponsor.map(s => typeof s === 'string' ? s.trim() : (s && typeof s.name === 'string' ? s.name.trim() : '')).filter(Boolean)
            : (typeof bill.sponsors === 'string' ? [bill.sponsors.trim()] : (typeof bill.sponsor === 'string' ? [bill.sponsor.trim()] : []));
    dom.modalSponsor.innerHTML = sponsors.length ? sponsors.join(', ') : 'N/A';
    const partyNames = Array.isArray(bill.parties)
        ? bill.parties
        : bill.party ? [bill.party] : [];
    if (partyNames.length) {
        dom.modalParty.innerHTML = partyNames.map((name, idx) => {
            const partyColor = partyColorMap[name] || '#888';
            const comma = idx < partyNames.length - 1 ? '<span style="color:#c5c5d6; margin-right: 8px">,</span>' : '';
            return `<span style="color:${partyColor};margin-right:4px;">●</span><span style="color:color-mix(${partyColor}, #c5c5d6 10%); font-weight:500;">${name || 'Independent'}</span>${comma}`;
        }).join('');
    } else {
        dom.modalParty.innerHTML = '<span style="color:#666;font-style:italic;">Unassigned</span>';
    }
    dom.modalDescription.innerHTML = bill.description || "<i>No description provided.</i>";
    dom.modalDate.textContent = bill.date || 'N/A';
    if (dom.modalLink) {
        const linkHref = bill.link?.trim();
        if (linkHref) {
            const finalHref = linkHref.startsWith('http') ? linkHref : `https://${linkHref}`;
            dom.modalLink.onclick = () => window.open(finalHref, '_blank', 'noopener');
            if (dom.modalLinkContainer) dom.modalLinkContainer.style.display = 'inline-block';
            dom.modalLink.style.display = 'inline-block';
            dom.modalLink.textContent = 'link';
        } else {
            dom.modalLink.onclick = null;
            if (dom.modalLinkContainer) dom.modalLinkContainer.style.display = 'none';
            dom.modalLink.style.display = 'none';
        }
    }

    const hasStage = bill.stage && bill.stage.trim() && bill.stage.toUpperCase() !== "N/A";
    if (dom.modalStageContainer) {
        dom.modalStageContainer.style.display = hasStage ? 'block' : 'none';
        if (hasStage && dom.modalStage) dom.modalStage.textContent = bill.stage;
    }

    const validTags = (bill.tags || []).filter(t => t?.trim());
    if (dom.modalTagsContainer) {
        dom.modalTagsContainer.style.display = validTags.length ? 'block' : 'none';
        if (validTags.length && dom.modalTags) dom.modalTags.innerHTML = validTags.join(', ');
    }

    dom.billModal.style.display = 'flex';
}

function closeModal() {
    if (dom.billModal) dom.billModal.style.display = 'none';
}

function renderBillCount() {
    if (!dom.billCount) return;
    const activeBills = bills.filter(bill => {
        const status = (bill.status || '').toString().trim().toLowerCase();
        return status === 'active' || status === 'passed';
    });
    dom.billCount.textContent = activeBills.length;
}

function renderCommitteeCount() {
    if (dom.committeeCount && dom.committeesContent) {
        const committees = dom.committeesContent.querySelectorAll('.ly-tier-banner .status-active');
        dom.committeeCount.textContent = committees.length;
    }
}

function applyAssemblyDataPayload(payload) {
    if (!payload || typeof payload !== 'object') return false;
    let applied = false;

    if (Array.isArray(payload.parties)) {
        parties = payload.parties.slice();
        applied = true;
    }
    if (Array.isArray(payload.coalitions)) {
        coalitions = payload.coalitions.slice();
        applied = true;
    }
    if (Array.isArray(payload.roster)) {
        roster = payload.roster.slice();
        applied = true;
    }
    if (Array.isArray(payload.bills)) {
        bills = payload.bills.slice();
        applied = true;
    }
    if (Array.isArray(payload.decrees)) {
        decrees = payload.decrees.slice();
        applied = true;
    }
    if (Array.isArray(payload.committees)) {
        committees = payload.committees.slice();
        applied = true;
    }
    if (payload.committeeCategoryColors && typeof payload.committeeCategoryColors === 'object') {
        committeeCategoryColors = Object.assign({}, payload.committeeCategoryColors);
        applied = true;
    }
    if (payload.statusCatalogs && typeof payload.statusCatalogs === 'object') {
        statusCatalogs = normalizeStatusCatalogs(payload.statusCatalogs);
        applied = true;
    }
    if (payload.chamber && typeof payload.chamber === 'object') {
        const ch = payload.chamber;
        if (ch.totalSeats !== undefined) totalSeats = Number(ch.totalSeats) || 0;
        if (ch.displaySeatCount !== undefined) displaySeatCount = Number(ch.displaySeatCount) || 0;
        if (ch.showSeatFraction !== undefined) showSeatFraction = Boolean(ch.showSeatFraction);
        if (ch.denseRows !== undefined) denseRows = Boolean(ch.denseRows);
        if (ch.electionDate !== undefined) {
            electionDate = String(ch.electionDate || '').trim() || 'TBA';
        }
        applied = true;
    }
    return applied;
}

function renderElectionDate() {
    const el = document.getElementById('election-date') || (dom && dom.electionDate);
    if (el) el.textContent = electionDate || 'TBA';
}

function rebuildPartyColorMap() {
    Object.keys(partyColorMap).forEach(k => { delete partyColorMap[k]; });
    parties.forEach(p => {
        if (p && p.name) partyColorMap[p.name] = p.color;
    });
}

function renderSyncedViews() {
    rebuildPartyColorMap();
    syncCoalitionPartyStrokes();
    if (typeof clearSeatSelection === 'function') clearSeatSelection();

    renderPartyLegend();
    renderPartyBoxes();
    setupSeatMap();
    renderAssemblyComposition();
    renderRoster();
    renderDecrees();
    renderCommittees();
    checkDecreesContent();
    checkCommitteesContent();
    preprocessBills();
    buildFilterClouds();
    renderBills();
    updateLatestEntries();
    if (typeof renderBillCount === 'function') renderBillCount();
    renderSeatCount();
    renderElectionDate();
}

let lastAssemblyDataSha = '';

function parseGithubRawUrl(url) {
    if (!url) return null;
    let m = String(url).trim().match(
        /^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/refs\/heads\/([^/]+)\/(.+?)(?:\?.*)?$/i
    );
    if (m) {
        return { owner: m[1], repo: m[2], branch: m[3], path: m[4] };
    }
    m = String(url).trim().match(
        /^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+?)(?:\?.*)?$/i
    );
    if (m) {
        return { owner: m[1], repo: m[2], branch: m[3], path: m[4] };
    }
    return null;
}

function githubContentsApiUrl(parsed) {
    const encodedPath = String(parsed.path || '')
        .split('/')
        .filter(Boolean)
        .map(encodeURIComponent)
        .join('/');
    return `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/contents/${encodedPath}`;
}

function decodeGithubBase64Content(b64) {
    const cleaned = String(b64 || '').replace(/\n/g, '');
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
}

async function fetchAssemblyDataFromRemote() {
    const base = typeof ASSEMBLY_DATA_URL === 'string' ? ASSEMBLY_DATA_URL.trim() : '';
    if (!base) return false;

    try {
        const parsed = parseGithubRawUrl(base);
        // Prefer Contents API over raw.githubusercontent.com (raw CDN often lags 1–5 minutes).
        if (parsed) {
            const apiUrl = `${githubContentsApiUrl(parsed)}?ref=${encodeURIComponent(parsed.branch)}`;
            const res = await fetch(apiUrl, {
                cache: 'no-store',
                headers: {
                    Accept: 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            });
            if (res.ok) {
                const meta = await res.json();
                if (meta && meta.sha && meta.sha === lastAssemblyDataSha) {
                    return false;
                }
                if (meta && meta.content) {
                    const payload = JSON.parse(decodeGithubBase64Content(meta.content));
                    lastAssemblyDataSha = meta.sha || '';
                    return applyAssemblyDataPayload(payload);
                }
            } else {
                console.warn('[assembly-data] API fetch failed:', res.status, apiUrl);
            }
        }

        // Fallback: raw URL (may be CDN-stale for a few minutes after publish)
        const url = base.includes('?')
            ? `${base}&_ts=${Date.now()}`
            : `${base}?_ts=${Date.now()}`;
        const rawRes = await fetch(url, { cache: 'no-store' });
        if (!rawRes.ok) {
            console.warn('[assembly-data] raw fetch failed:', rawRes.status, url);
            return false;
        }
        const payload = await rawRes.json();
        return applyAssemblyDataPayload(payload);
    } catch (err) {
        console.warn('[assembly-data] remote fetch error:', err);
    }
    return false;
}

async function init() {
    dom.rosterTbody = $('#roster-tbody');
    dom.partyLegend = $('#party-legend');
    dom.partyBoxes = $('#party-boxes');
    dom.seatMap = $('#seatMap');
    dom.seatTooltip = $('#seat-tooltip');
    dom.decreesContent = $('#decrees-content');
    dom.dynamicContainer = $('#dynamic-tables-container');
    dom.committeesContent = $('#committees-content');
    dom.billModal = $('#bill-modal');
    dom.modalNumber = $('#modal-number');
    dom.modalTitle = $('#modal-title');
    dom.modalType = $('#modal-type');
    dom.modalStatus = $('#modal-status');
    dom.modalSponsor = $('#modal-sponsor');
    dom.modalParty = $('#modal-party');
    dom.modalDescription = $('#modal-description');
    dom.modalDate = $('#modal-date');
    dom.modalLink = $('#modal-link');
    dom.modalLinkContainer = $('#modal-link-container');
    dom.modalStage = $('#modal-stage');
    dom.modalTags = $('#modal-tags');
    dom.modalStageContainer = $('#modal-stage-container');
    dom.modalTagsContainer = $('#modal-tags-container');
    dom.billCount = $('#bill-count');
    dom.committeeCount = $('#committee-count');
    dom.districtSeatCount = $('#district-seat-count');
    dom.seatCountText = $('#seat-count-text');
    dom.controlDrawer = $('#control-panel-drawer');
    dom.drawerCaret = $('#drawer-caret');
    dom.statusCloud = $('#status-cloud-container');
    dom.typeCloud = $('#type-cloud-container');
    dom.tagCloud = $('#tag-cloud-container');
    dom.newestBill = $('#newest-bill');
    dom.newestDecree = $('#newest-decree');
    dom.electionDate = $('#election-date');

    parties.forEach(p => { partyColorMap[p.name] = p.color; });
    syncCoalitionPartyStrokes();

    window.addEventListener('click', () => {
        clearSeatSelection();
    });

    renderPartyLegend();
    renderPartyBoxes();
    setupSeatMap();
    renderAssemblyComposition();
    renderRoster();
    renderDecrees();
    renderCommittees();
    preprocessBills();
    buildFilterClouds();
    renderBills();
    updateLatestEntries();
    checkDecreesContent();
    checkCommitteesContent();
    renderBillCount();
    renderElectionDate();

    if (await fetchAssemblyDataFromRemote()) {
        renderSyncedViews();
    }

    const pollMs = Number(ASSEMBLY_DATA_POLL_MS) || 0;
    if (pollMs > 0 && ASSEMBLY_DATA_URL && ASSEMBLY_DATA_URL.trim()) {
        setInterval(async () => {
            if (await fetchAssemblyDataFromRemote()) {
                renderSyncedViews();
            }
        }, pollMs);
    }
}

let __assemblyBooted = false;
async function bootAssembly() {
    if (__assemblyBooted) return;
    __assemblyBooted = true;
    try {
        await init();
    } catch (err) {
        console.error('[assembly] init failed:', err);
    }
}
if (document.readyState === 'complete') {
    bootAssembly();
} else {
    window.addEventListener('load', bootAssembly);
}
