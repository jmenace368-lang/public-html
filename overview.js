    //  DATA — Copy/edit the formats in their respective functions (remove comments when done).
    // name: Party Name, color: Party Color, seats: Number of Seats, logo: Party Logo, stroke: Party Stroke, Description: Party Description (disabled)
    // Use the stroke property to add a border to party seats. This is used to represent coalitions & must be manually set for each party using the coalition's color.
    // Removing seats parameter or setting its value to 0 will remove that party from additional UI elements like the roster & legend but enable its use elsewhere.
    const parties = [
        { name: "The Optimates", color: "#783981", seats: 2, logo: "https://i.ibb.co/MxV0LCgH/logo-rew-ot.png", },
        { name: "Combine Labour Co-operative", color: "#c52237", seats: 3, logo: "https://i.ibb.co/0ydBg5Tq/clc.png", },

    ];

    // name: Coalition Name, color: Coalition Color, seats: Number of Seats (redundant), logo: Coalition Logo (redundant), border: Coalition Border, Description: Party Description (disabled)
    // Parameters like logo, seats, and description can be set but will otherwise not be used and will not be referenced in the party or council roster.
    // Uses border instead of stroke for legend circle.
    const coalitions = [
        // { name: "Coalition Name", color: "#c52237", border: "dotted 2px purple", },
    ];

    // rank: Member Rank (Overseer, Chairperson, Councillor), cid: Member CID, name: Member Name, party: Member Party (Optional - Must match parties' name), partyColor: Member Party (Optional/Override)
    // (OUTDATED) The partyColor parameter exists for the Chairperson. It is a specific override to ensure the Chairperson's party color, if applicable, remains represented even if they don't have a party on the Council. If no partyColor is set, it will default to the party color value if applicable, and if not, default to grey instead.
    // (UPDATED) Override is no longer necessary.
    // Inherits the same color value from the parties variable provided they share the same name.
    const roster = [
        { rank: "Chairperson", cid: "#11111", name: "Karl Söderberg", party: "The Harmony Coalition", partyColor: "#dbb542" },
        { rank: "Councillor", cid: "#11111", name: "Julius Knightly", party: "The Optimates", },
        { rank: "Councillor", cid: "#11111", name: "Rupert Rhodes", party: "The Optimates" },
        { rank: "Councillor", cid: "#11111", name: "Horatio Kingsley", party: "Combine Labour Co-operative" },
        { rank: "Councillor", cid: "#11111", name: "Tim Keyes", party: "Combine Labour Co-operative" },
        { rank: "Councillor", cid: "#11111", name: "Youssef Sayagh", party: "Combine Labour Co-operative" },
    ];

    // Sponsors, parties & Tags must be arrays.  All others can be left blank.  Stage automatically deletes itself if left blank.
    // number: Bill Number, title: Bill Name, type: Bill Type, status: Current Status, date: Creation Date, session: Session Number, sponsors: Sponsor Names, parties: Party Names, description: Bill's Description (supports HTML), stage: Current Stage, tags: Relevant Tags, link: Link to Legislation
    const bills = [
        {
            number: "",
            title: "",
            type: "",
            status: "",
            date: "",
            session: "",
            sponsors: [""],
            parties: [""],
            description: "",
            stage: "",
            tags: ["", "", ""],
            link: ""
        },
    ];

    // number: Decree Number, title: Decree Name, name: Issuer Name, role: Issuer Role, classOverride: Custom Class (Optional; supports strings or arrays), date: Creation Date, status: Current Status, category: Decree Category, description: Decree Description (supports HTML), expiresAt: Expiration Date (ISO 8601)
    // Not setting expiresAt removes expiration date completely.
    // Not setting role defaults to "Overwatch".
    // (CRUCIAL) - the first letter/number of the decree number will always be used to categorize session UI. The exact format is [session]-[number].  For example, "1-01" is session 1, decree 1.
    // Setting classOverride to "pinned" will pin the decree to the top of the page.
    const decrees = [
        {
            number: "", title: "",
            role: "",
            classOverride: "",
            date: "", status: "", category: "",
            description: "",
            expiresAt: ""
        },
    ];

    const committeeCategoryColors = {
        "Special Committees": "#c52237",
        "Standing Committees": "#1e90ff",
        "Ad Hoc Committees": "#32cd32"
    };

    // category: Committee Category Heading, title: Committee Name, date: Est. Date, status: Current Status, classOverride: Custom Class (Optional; supports strings or arrays), description: Committee Description, members: Array of member objects
    // Each member can contain { name, chair }.
    // Setting classOverride to "pinned" will pin the committee to the top of its category.
    const committees = [
        {
            category: "Special Committees",
            title: "The Affairs Commission",
            date: "Est. Date",
            status: "inactive",
            classOverride: "pinned",
            description: "Oversees the Loyalist system, its Collaborators, and its integrity.",
            members: [
                { name: "Karina Orlova", chair: true },
                { name: "Name", chair: false }
            ]
        },
    ];

    // Use 0 to default to assigned seat count.
    const totalSeats = 0;
    const defaultLogo = "https://combineoverwiki.net/images/thumb/3/34/Wasteland_Scanner_logo.svg/470px-Wasteland_Scanner_logo.svg.png";
    const vacantColor = "rgba(255,255,255,0)";
    // #777777
    const vacantOpacity = "1";
    const vacantStroke = "rgba(255,255,255,0.08)";

    //  CACHE

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
    const PAGE_LOAD_TIME = new Date();
    const EXPIRY_OVERRIDES = ['rescinded', 'withdrawn', 'on hold', 'pending'];

    //  UTILITIES

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

    function getStatusHTML(status) {
        return `<span class="status status-${status}">${status}</span>`;
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
                metaSpan.textContent = `${summary.type} · ${summary.status}`;

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
                metaSpan.textContent = `${summary.category} · ${summary.status}`;

                dom.newestDecree.appendChild(titleSpan);
                dom.newestDecree.appendChild(metaSpan);
            } else {
                dom.newestDecree.textContent = 'No latest decree';
                dom.newestDecree.style.cursor = 'default';
                dom.newestDecree.onclick = null;
            }
        }
    }

    //  OVERVIEW RENDERERS

    function renderAssemblyComposition() {
        const overseer = roster.find(m => m.rank === 'Overseer');
        const chairperson = roster.find(m => m.rank === 'Chairperson');

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

        // Delete to include Overseer / restores Overseer
        const visibleMembers = roster.filter(member => member.rank !== 'Overseer');

        visibleMembers.forEach(member => {
            const tr = document.createElement('tr');
            if (member.rank === 'Chairperson') tr.classList.add('chairperson-row');

            const col = member.partyColor || partyColorMap[member.party] || '#888';
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

    // If you need to add a border to the legend circle, just copy 'border:${c.border}' from renderCoalitionLegend and insert below.
    // Afterward, you can set the border value in const parties using the border parameter (border: {color}).
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

    function renderCoalitionLegend() {
        if (!dom.coalitionLegend) return;
        dom.coalitionLegend.innerHTML = '';

        coalitions.forEach(c => {
            const el = document.createElement('div');
            el.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:13px;';
            el.innerHTML = `
            <span style="width:11px;height:11px;border-radius:50%;background:color-mix(${c.color}, transparent 40%);border:${c.border};flex-shrink:0;"></span>
            <span style="opacity:0.75;color:color-mix(${c.color}, #c5c5d6 20%); letter-spacing: 2px;">${c.name}</span>
        `;
            dom.coalitionLegend.appendChild(el);
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
            // Start of Description 
            const descriptionHTML = p.description
                ? `<div class="ly-tier-desc" style="padding-top:10px;">${p.description}</div>`
                : '';
            // End of Description - comment out ${descriptionHTML} too if we want to remove descriptions.
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

    function renderSeatCount() {
        const assignedSeats = parties.reduce((sum, party) => sum + (Number(party.seats) || 0), 0);
        const resolvedTotalSeats = Number.isFinite(totalSeats) && totalSeats > 0 ? totalSeats : assignedSeats;
        const displayValue = assignedSeats >= resolvedTotalSeats ? String(resolvedTotalSeats) : `${assignedSeats}/${resolvedTotalSeats}`;

        if (dom.districtSeatCount) {
            dom.districtSeatCount.textContent = displayValue;
        }

        if (dom.seatCountText) {
            dom.seatCountText.textContent = displayValue;
        }
    }

    function setupSeatMap() {
        if (!dom.seatMap) return;

        let defs = dom.seatMap.querySelector('defs');
        if (!defs) {
            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            dom.seatMap.insertBefore(defs, dom.seatMap.firstChild);
        }

        const circles = Array.from(dom.seatMap.querySelectorAll('circle'));
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
            for (let i = 0; i < party.seats && seatIdx < circles.length; i++, seatIdx++) {
                const c = circles[seatIdx];
                const partyStroke = (party.stroke || '').trim();
                c.setAttribute('fill', `url(#${gid})`);
                c.setAttribute('data-party', party.name);
                c.setAttribute('data-color', party.color);
                c.setAttribute('stroke', partyStroke || 'none');
                c.setAttribute('stroke-width', partyStroke ? '1.5' : '0');
                c.style.filter = 'drop-shadow(0 0 3px rgba(0,0,0,0.15))';
                c.style.cursor = 'pointer';
                c.style.transition = 'opacity 0.15s';
            }
        });

        while (seatIdx < circles.length) {
            const c = circles[seatIdx++];
            c.setAttribute('fill', vacantColor);
            c.setAttribute('stroke', vacantStroke);
            c.setAttribute('stroke-width', '1');
            c.setAttribute('data-party', 'Vacant');
            c.setAttribute('data-color', '#888');
            c.setAttribute('opacity', vacantOpacity);
        }

        renderSeatCount();

        if (dom.seatTooltip) {
            dom.seatTooltip.style.pointerEvents = 'none';
            dom.seatTooltip.style.userSelect = 'none';
        }

        circles.forEach(c => {
            c.addEventListener('click', (e) => {
                if (!dom.seatTooltip) return;
                e.stopPropagation();

                if (activeTooltipCircle === c) {
                    resetTooltip();
                } else {
                    const party = c.getAttribute('data-party');
                    const color = c.getAttribute('data-color');
                    dom.seatTooltip.textContent = party === 'Vacant' ? '' : party;
                    dom.seatTooltip.style.color = color || '#888';
                    activeTooltipCircle = c;
                }
            });
        });
    }

    function resetTooltip() {
        if (!dom.seatTooltip) return;
        dom.seatTooltip.textContent = '';
        dom.seatTooltip.style.color = 'rgba(255,255,255,0.35)';
        activeTooltipCircle = null;
    }

    //  DECREE EXPIRY FUNCTION

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
        if (EXPIRY_OVERRIDES.includes(d.status)) {
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
                labelSuffix: ` · Expired ${agoStr} ago`,
            };
        }

        const resolvedStatus = d.status === 'expired' ? 'active' : d.status;
        const countStr = formatDuration(diff, false);
        return {
            resolvedStatus,
            labelSuffix: ` · Expires in ${countStr}`,
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
            const pinnedBadge = isPinned ? '<span class="status status-pinned">Pinned</span>' : '';

            card.innerHTML = `
                <div class="ly-tier-banner-header">
                    <div style="flex:1;">
                        <div class="ly-tier-label">${d.number || 'N/A'} · ${d.category || 'N/A'} · ${d.date || 'N/A'}${labelSuffix}</div>
                        <div class="ly-tier-title">${d.title || 'Untitled Decree'}</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
                        <span class="status status-${resolvedStatus}">${resolvedStatus}</span>
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
                const pinnedBadge = isPinned ? '<span class="status status-pinned">Pinned</span>' : '';

                card.innerHTML = `
                    <div class="ly-tier-banner-header">
                        <div style="flex:1;">
                            <div class="ly-tier-label">${committee.category || 'Committee'} · ${committee.date || 'Est. Date'}</div>
                            <div class="ly-tier-title">${committee.title || 'Untitled Committee'}</div>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
                            <span class="status status-${committee.status || 'inactive'}">${committee.status || 'inactive'}</span>
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

    //  DECREES EMPTY ALT

    function checkDecreesContent() {
        if (!dom.decreesContent) return;
        const decreeCards = dom.decreesContent.querySelectorAll('.ly-tier-banner');
        if (decreeCards.length === 0) {
            dom.decreesContent.innerHTML = '<h3 style="text-align:center;color:#6a6a7a;">No decrees on record.</h3>';
        }
    }
    //  LEGISLATION — FILTER / SORT

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
        dom.drawerCaret.textContent = open ? '▲' : '▼';
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
                    d.textContent = isAscending ? ' ▲' : ' ▼';
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
                        <td style="text-align: center;">${getStatusHTML(bill.status || 'N/A')}</td>
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

    //  BILL MODAL / COUNTERS

    function showBillDetails(bill) {
        if (!dom.billModal) return;

        dom.modalNumber.textContent = `Bill ${bill.number || 'N/A'} · Session ${bill.session || 'N/A'} · ${bill.type || 'N/A'}`;
        dom.modalTitle.textContent = bill.title || 'Untitled Bill';
        dom.modalType.innerHTML = getTypeHTML(bill.type || 'N/A');
        dom.modalStatus.innerHTML = getStatusHTML(bill.status || 'N/A');
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

    //  INIT


    function init() {
        dom.rosterTbody = $('#roster-tbody');
        dom.partyLegend = $('#party-legend');
        dom.coalitionLegend = $('#coalition-legend');
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

        parties.forEach(p => { partyColorMap[p.name] = p.color; });

        window.addEventListener('click', () => {
            if (activeTooltipCircle) resetTooltip();
        });

        renderPartyLegend();
        renderCoalitionLegend();
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
        renderBillCount();
    }

    window.addEventListener('load', init);
