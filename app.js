let map;
window.initMap = function() {
    // Default coordinates (Zurich)
    let center = { lat: 47.3769, lng: 8.5417 };
    
    map = new google.maps.Map(document.getElementById('map-bg'), {
        center: center,
        zoom: 14,
        disableDefaultUI: true,
        styles: [
            {elementType: 'geometry', stylers: [{color: '#ebe3cd'}]},
            {elementType: 'labels.text.fill', stylers: [{color: '#523735'}]},
            {elementType: 'labels.text.stroke', stylers: [{color: '#f5f1e6'}]},
            {featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{color: '#c9b2a6'}]},
            {featureType: 'administrative.land_parcel', elementType: 'geometry.stroke', stylers: [{color: '#dcd2be'}]},
            {featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{color: '#ae9e90'}]},
            {featureType: 'landscape.natural', elementType: 'geometry', stylers: [{color: '#dfd2ae'}]},
            {featureType: 'poi', elementType: 'geometry', stylers: [{color: '#dfd2ae'}, {visibility: 'off'}]}, /* Hide POIs so it looks like a clean map */
            {featureType: 'poi', elementType: 'labels.text.fill', stylers: [{color: '#93817c'}]},
            {featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{color: '#a5b076'}]},
            {featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{color: '#447530'}]},
            {featureType: 'road', elementType: 'geometry', stylers: [{color: '#f5f1e6'}]},
            {featureType: 'road.arterial', elementType: 'geometry', stylers: [{color: '#fdfcf8'}]},
            {featureType: 'road.highway', elementType: 'geometry', stylers: [{color: '#f8c967'}]},
            {featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{color: '#e9bc62'}]},
            {featureType: 'road.highway.controlled_access', elementType: 'geometry', stylers: [{color: '#e98d58'}]},
            {featureType: 'road.highway.controlled_access', elementType: 'geometry.stroke', stylers: [{color: '#db8555'}]},
            {featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{color: '#806b63'}]},
            {featureType: 'transit.line', elementType: 'geometry', stylers: [{color: '#dfd2ae'}]},
            {featureType: 'transit.line', elementType: 'labels.text.fill', stylers: [{color: '#8f7d77'}]},
            {featureType: 'transit.line', elementType: 'labels.text.stroke', stylers: [{color: '#ebe3cd'}]},
            {featureType: 'transit.station', elementType: 'geometry', stylers: [{color: '#dfd2ae'}]},
            {featureType: 'water', elementType: 'geometry.fill', stylers: [{color: '#b9d3c2'}]},
            {featureType: 'water', elementType: 'labels.text.fill', stylers: [{color: '#92998d'}]}
        ]
    });

    // Map initialization is now purely visual; location is handled via the Scan button.
};

// State Management
const state = {
    placesVisited: 0,
    currentLevel: 1,
    nodes: [
        { id: 1, x: 20, y: 70, title: "The Hidden Bakery", desc: "A local favorite untouched by tourists. Find the hidden entrance behind the old brick wall.", status: 'hidden' }, // status: hidden, active, visited
        { id: 2, x: 50, y: 50, title: "Rooftop Garden", desc: "Access the service elevator to find this tranquil oasis above the city.", status: 'hidden' },
        { id: 3, x: 80, y: 30, title: "Neon Alleyway", desc: "At 9 PM, the neon signs align perfectly here. A local photographer's secret spot.", status: 'hidden' },
        { id: 4, x: 60, y: 80, title: "Jazz Basement", desc: "Listen carefully. Knock three times on the blue door.", status: 'hidden' },
    ],
    currentNodeIndex: -1,
    isSubscribed: false,
    // PERMANENT BACKEND URL (Render.com — never changes!)
    BACKEND_URL: 'https://wanderlost-app.onrender.com' 
};

// Custom Modal System (To hide domain and match aesthetic)
function showAlert(message, title = "Notice", icon = "fa-circle-info") {
    const modal = document.getElementById('custom-modal');
    const msgEl = document.getElementById('modal-message');
    const titleEl = document.getElementById('modal-title');
    const iconEl = document.getElementById('modal-icon');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    const okBtn = document.getElementById('modal-ok-btn');

    msgEl.textContent = message;
    titleEl.textContent = title;
    iconEl.innerHTML = `<i class="fa-solid ${icon}"></i>`;
    cancelBtn.classList.add('hidden');
    
    modal.classList.remove('hidden');

    return new Promise((resolve) => {
        okBtn.onclick = () => {
            modal.classList.add('hidden');
            resolve(true);
        };
    });
}

function showConfirm(message, title = "Confirmation", icon = "fa-circle-question") {
    const modal = document.getElementById('custom-modal');
    const msgEl = document.getElementById('modal-message');
    const titleEl = document.getElementById('modal-title');
    const iconEl = document.getElementById('modal-icon');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    const okBtn = document.getElementById('modal-ok-btn');

    msgEl.textContent = message;
    titleEl.textContent = title;
    iconEl.innerHTML = `<i class="fa-solid ${icon}"></i>`;
    cancelBtn.classList.remove('hidden');
    
    modal.classList.remove('hidden');

    return new Promise((resolve) => {
        okBtn.onclick = () => {
            modal.classList.add('hidden');
            resolve(true);
        };
        cancelBtn.onclick = () => {
            modal.classList.add('hidden');
            resolve(false);
        };
    });
}

// DOM Elements
let nodesContainer, trailSvg, fogOverlay;
let locationCard, idlePrompt, locTitle, locDesc, progressFill, badges, mapBg;
let btnReady, btnScan, btnSettings, modalSub, btnCloseSub, btnSubscribeNow;
let modalCheckout, btnCloseCheckout, btnConfirmPayment;
let modalProfile, btnCloseProfile;
let modalLegal, btnCloseLegal;
let historyList, btnStartJourney, modalWelcome;

// Initialize
function init() {
    console.log("Wanderløst Intelligence Rig: Initializing DOM...");
    
    // Bind core layers
    nodesContainer = document.getElementById('nodes-container');
    trailSvg = document.getElementById('trail-svg');
    fogOverlay = document.getElementById('fog-overlay');
    
    // Bind UI elements safely
    locationCard = document.getElementById('location-card');
    idlePrompt = document.getElementById('idle-prompt');
    locTitle = document.getElementById('loc-title');
    locDesc = document.getElementById('loc-desc');
    progressFill = document.querySelector('.progress-fill');
    badges = document.querySelectorAll('.badges-mini i');
    mapBg = document.getElementById('map-bg');
    
    btnReady = document.getElementById('ready-btn');
    btnScan = document.getElementById('scan-btn');
    btnSettings = document.getElementById('settings-btn');
    
    modalSub = document.getElementById('subscription-modal');
    if (modalSub) btnCloseSub = modalSub.querySelector('.close-btn');
    btnSubscribeNow = document.getElementById('subscribe-now-btn');
    
    modalCheckout = document.getElementById('checkout-modal');
    if (modalCheckout) btnCloseCheckout = modalCheckout.querySelector('.close-btn');
    btnConfirmPayment = document.getElementById('confirm-payment-btn');
    
    modalProfile = document.getElementById('profile-modal');
    if (modalProfile) btnCloseProfile = modalProfile.querySelector('.close-btn');
    
    modalLegal = document.getElementById('legal-modal');
    if (modalLegal) btnCloseLegal = modalLegal.querySelector('.close-btn');
    
    historyList = document.querySelector('.history-list');
    btnStartJourney = document.getElementById('start-journey-btn');
    modalWelcome = document.getElementById('welcome-modal');

    // Verify critical buttons
    const btnOpenProfile = document.getElementById('open-profile-btn');
    console.log("Dossier Button Found:", !!btnOpenProfile);
    console.log("Welcome Modal Found:", !!modalWelcome);    // Safe Event Binding Helper
    const safeBind = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener(event, handler);
            console.log(`Bound ${event} to #${id}`);
        } else {
            console.warn(`Could not find #${id} to bind ${event}`);
        }
    };

    const safeBindClass = (selector, event, handler) => {
        const els = document.querySelectorAll(selector);
        els.forEach(el => el.addEventListener(event, handler));
    };

    // Welcome Screen Flow
    if (btnStartJourney) {
        btnStartJourney.onclick = () => {
            modalWelcome.style.opacity = '0';
            modalWelcome.style.pointerEvents = 'none'; // Essential: prevent ghost blocking
            setTimeout(() => {
                modalWelcome.classList.add('hidden');
                setTimeout(() => {
                    if (btnScan) btnScan.click();
                }, 500);
            }, 1000);
        };
    }

    // Profile Trigger (High Priority)
    const profileBtn = document.getElementById('open-profile-btn');
    if (profileBtn) {
        profileBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("Opening Profile...");
            if (modalProfile) {
                modalProfile.classList.remove('hidden');
                modalProfile.style.display = 'flex';
                modalProfile.style.opacity = '1';
                modalProfile.style.pointerEvents = 'auto';
            }
        };
        // Also bind to avatar specifically just in case
        const avatar = profileBtn.querySelector('.avatar');
        if (avatar) avatar.onclick = (e) => {
            e.stopPropagation();
            profileBtn.click();
        };
    }

    // Close Buttons
    if (btnCloseProfile) btnCloseProfile.onclick = () => modalProfile.classList.add('hidden');
    if (btnCloseSub) btnCloseSub.onclick = () => modalSub.classList.add('hidden');
    if (btnCloseLegal) btnCloseLegal.onclick = () => modalLegal.classList.add('hidden');
    if (btnCloseCheckout) btnCloseCheckout.onclick = () => {
        modalCheckout.classList.add('hidden');
        if (previousModalForCheckout) previousModalForCheckout.classList.remove('hidden');
    };

    // The core scan function — called only after user approves location
    async function startScan() {
        const locationPermModal = document.getElementById('location-permission-modal');
        if (locationPermModal) locationPermModal.classList.add('hidden');
        if (btnScan) {
            btnScan.disabled = true;
            btnScan.innerHTML = '<i class="fa-solid fa-location-crosshairs fa-spin"></i> Getting GPS...';
        }
        
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(async (position) => {
                const { latitude, longitude } = position.coords;
                
                if (btnScan) btnScan.innerHTML = '<i class="fa-solid fa-filter fa-spin"></i> Verifying Authenticity...';
                
                try {
                    // Call our new backend
                    const response = await fetch(`${state.BACKEND_URL}/api/discover`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ lat: latitude, lng: longitude })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        if (btnScan) btnScan.innerHTML = '<i class="fa-solid fa-microchip fa-spin"></i> Analyzing Cultural Signals...';
                        
                        setTimeout(() => {
                            // Inject the real data into the state
                            // We assign random x/y for the "Paper Map" view so they show up within bounds (20% to 80%)
                            const node = {
                                id: Date.now(),
                                title: result.data.title,
                                desc: result.data.desc,
                                lat: result.data.lat,
                                lng: result.data.lng,
                                x: 30 + Math.random() * 40, 
                                y: 30 + Math.random() * 40,
                                reason: result.data.reason,
                                status: 'active'
                            };
                            
                            state.nodes.push(node);
                            state.currentNodeIndex = state.nodes.length - 1;
                            
                            renderNodes();
                            showLocationDetails(node);
                            
                            if (btnScan) {
                                btnScan.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Initiate Scan';
                                btnScan.disabled = false;
                            }
                        }, 1800);
                    } else {
                        await showAlert(result.message || "No local gems found nearby.", "Discovery Failed", "fa-building-circle-exclamation");
                        if (btnScan) {
                            btnScan.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Initiate Scan';
                            btnScan.disabled = false;
                        }
                    }
                } catch (err) {
                    console.error("Discovery API Error:", err);
                    await showAlert(`Unable to reach the Intelligence Rig.

If this is your first time scanning today, please visit your tunnel link manually in your browser to click the "Bypass" button:
${state.BACKEND_URL}`, "Connection Error", "fa-tower-broadcast");
                    if (btnScan) {
                        btnScan.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Initiate Scan';
                        btnScan.disabled = false;
                    }
                }
            }, (error) => {
                showAlert("GPS Access Denied. To discover secret spots, please enable location services in your browser settings.", "GPS Required", "fa-location-dot");
                if (btnScan) {
                    btnScan.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Initiate Scan';
                    btnScan.disabled = false;
                }
            });
        } else {
            showAlert("Geolocation is not supported by your browser.", "Device Error", "fa-mobile-screen");
            if (btnScan) btnScan.disabled = false;
        }
    } // end startScan()

    // Discover & Scans
    safeBind('scan-btn', 'click', () => {
        const locationPermModal = document.getElementById('location-permission-modal');
        if (locationPermModal) locationPermModal.classList.remove('hidden');
        else startScan();
    });

    safeBind('location-allow-btn', 'click', () => startScan());
    safeBind('location-deny-btn', 'click', () => {
        const locationPermModal = document.getElementById('location-permission-modal');
        if (locationPermModal) locationPermModal.classList.add('hidden');
        if (btnScan) {
            btnScan.disabled = false;
            btnScan.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Initiate Scan';
        }
    });

    // Core Discovery Actions
    safeBind('ready-btn', 'click', () => {
        const node = state.nodes[state.currentNodeIndex];
        const lat = node.lat || 47.3769; 
        const lng = node.lng || 8.5417;
        const encodedName = encodeURIComponent(node.title);
        let mapUrl = '';
        if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            mapUrl = `http://maps.apple.com/?q=${encodedName}&ll=${lat},${lng}`;
        } else {
            mapUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        }
        window.open(mapUrl, '_blank');
        completeCurrentLocation();
    });

    let previousModalForCheckout = null;

    // Subscription & Flow
    safeBind('settings-btn', 'click', async () => {
        if(state.isSubscribed) {
            await showAlert("Active Status: Wanderløst Elite", "Already Member", "fa-user-check");
        } else {
            if (modalSub) modalSub.classList.remove('hidden');
        }
    });

    safeBind('subscribe-now-btn', 'click', () => {
        previousModalForCheckout = modalSub;
        if (modalSub) modalSub.classList.add('hidden');
        if (modalCheckout) modalCheckout.classList.remove('hidden');
    });

    // Payment Logic
    safeBind('confirm-payment-btn', 'click', () => {
        const form = document.getElementById('checkout-form');
        if(!form.checkValidity()) { form.reportValidity(); return; }
        
        const btnText = btnConfirmPayment.querySelector('.btn-text');
        const spinner = btnConfirmPayment.querySelector('.btn-spinner');
        if (btnText) btnText.textContent = 'Verifying...';
        if (spinner) spinner.classList.remove('hidden');
        if (btnConfirmPayment) btnConfirmPayment.disabled = true;

        setTimeout(async () => {
            if (btnText) btnText.textContent = 'Authorized';
            if (spinner) spinner.classList.add('hidden');
            state.isSubscribed = true;
            setTimeout(async () => {
                if (modalCheckout) modalCheckout.classList.add('hidden');
                await showAlert("Welcome to Elite.", "Membership Active", "fa-crown");
                if (btnConfirmPayment) {
                    btnConfirmPayment.disabled = false;
                    if (btnText) btnText.textContent = 'Pay 20.00 CHF';
                }
            }, 800);
        }, 2000);
    });

    // Footer Links (Safe Bindings)
    safeBind('manage-payments-btn', 'click', async () => {
        if(state.isSubscribed) await showAlert("Plan: Elite\nRenewal: Monthly", "Subscription", "fa-credit-card");
        else { 
            if (modalProfile) modalProfile.classList.add('hidden'); 
            if (modalSub) modalSub.classList.remove('hidden'); 
        }
    });
    
    safeBind('terms-btn', 'click', () => {
        if (modalProfile) modalProfile.classList.add('hidden');
        if (modalLegal) modalLegal.classList.remove('hidden');
    });

    safeBind('cancel-membership-btn', 'click', async () => {
        const confirmed = await showConfirm("Cancel Elite membership?", "Confirmation", "fa-ban");
        if(confirmed) await showAlert("Request sent.", "Membership", "fa-check");
    });

    safeBind('delete-data-btn', 'click', async () => {
        const confirmed = await showConfirm("Permanently delete travel trails?", "Danger", "fa-trash");
        if(confirmed) { await showAlert("Dossier purged.", "Deleted", "fa-trash"); location.reload(); }
    });

    // Clear the dummy HTML history on init so it's accurate to the state
    if (historyList) historyList.innerHTML = `<p class="history-empty hidden">No secrets uncovered yet.</p>`;
    
    // Set Dynamic Renewal Date for compliance
    const renewalEl = document.getElementById('dynamic-renewal-date');
    if(renewalEl) {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        renewalEl.textContent = d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    }

    // Collapse Card Logic
    safeBind('collapse-btn', 'click', () => {
        if (locationCard) locationCard.classList.toggle('is-collapsed');
    });
    
    renderNodes();
    
    // Simulate panning on start
    if (mapBg) {
        setTimeout(() => {
            mapBg.classList.add('map-panning');
        }, 100);
    }
}

function renderNodes() {
    nodesContainer.innerHTML = '';
    state.nodes.forEach((node, index) => {
        const el = document.createElement('div');
        el.className = `map-node ${node.status === 'hidden' ? 'hidden-node' : node.status}`;
        el.style.left = `${node.x}%`;
        el.style.top = `${node.y}%`;
        el.id = `node-${node.id}`;
        
        // Custom elegant marker content
        el.innerHTML = `<span class="marker-text">${index + 1}</span>`;
        
        // Click to view active or visited locations, or interact with mystery spots
        el.addEventListener('click', () => {
            if (node.status === 'active' || node.status === 'visited') {
                showLocationDetails(node);
            } else if (node.status === 'hidden') {
                // Focus user's attention on the scan button
                idlePrompt.scrollIntoView({ behavior: 'smooth', block: 'end' });
                btnScan.style.transform = 'scale(1.1)';
                setTimeout(() => btnScan.style.transform = 'scale(1)', 200);
            }
        });
        
        nodesContainer.appendChild(el);
    });
    
    drawTrails();
}

function drawTrails() {
    trailSvg.innerHTML = '';
    
    let nodesToDraw = state.nodes.filter(n => n.status === 'visited' || n.status === 'active');
    
    // If only one discovery, draw trail from a starting point (approx center/home)
    if (nodesToDraw.length === 1) {
        nodesToDraw = [{x: 50, y: 50}, ...nodesToDraw];
    }
    
    if (nodesToDraw.length < 2) return;

    let pathD = '';
    for (let i = 0; i < nodesToDraw.length - 1; i++) {
        const start = nodesToDraw[i];
        const end = nodesToDraw[i+1];
        
        // Convert % to pixels roughly based on container size for the SVG path
        // Using % for SVG elements requires viewBox logic, so we'll just set paths using percentages
        // Actually, SVG paths don't support percentages natively in "d" attribute in the same way,
        // so we'll map them relative to a 100x100 viewbox.
        
        if (i === 0) {
            pathD += `M ${start.x} ${start.y} `;
        }
        
        // Add a slight curve (bezier)
        const midX = (start.x + end.x) / 2 + (Math.random() * 20 - 10);
        const midY = (start.y + end.y) / 2 + (Math.random() * 20 - 10);
        
        pathD += `Q ${midX} ${midY}, ${end.x} ${end.y} `;
    }

    trailSvg.setAttribute('viewBox', '0 0 100 100');
    trailSvg.setAttribute('preserveAspectRatio', 'none');
    
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute('d', pathD);
    path.setAttribute('class', 'trail-line');
    path.setAttribute('vector-effect', 'non-scaling-stroke'); // Keeps stroke width constant
    trailSvg.appendChild(path);
}

// Handle Google Maps API missing-key errors quietly for local demo purposes
function hideGoogleWatermarks() {
    const style = document.createElement('style');
    style.innerHTML = `
        .dismissButton, 
        .gm-err-container, 
        .gm-style-mtc, 
        .gm-style-bg,
        div[style*="background-image: url"] { display: none !important; }
        
        .gm-style div, .gm-style span {
            background-color: transparent !important;
        }
    `;
    document.head.appendChild(style);
    
    // Also periodically remove any new divs Google pushes
    setInterval(() => {
        const divs = document.querySelectorAll('.gm-style div');
        divs.forEach(div => {
            if(div.innerHTML.includes('development purposes only')) {
                div.style.display = 'none';
            }
        });
    }, 500);
}

// In case it calls the auth failure anyway
window.gm_authFailure = hideGoogleWatermarks;

function revealNextNode() {
    if (state.currentNodeIndex >= state.nodes.length - 1) {
        // Out of places, prompt subscription or end
        modalSub.classList.remove('hidden');
        idlePrompt.innerHTML = '<h3>Out of free hints</h3><p>Subscribe to discover more!</p><button id="settings-btn" class="primary-btn gold-btn glow-btn-gold">Upgrade Now</button>';
        return;
    }

    state.currentNodeIndex++;
    const node = state.nodes[state.currentNodeIndex];
    node.status = 'active';
    
    // Update map visualization
    renderNodes();
    
    showLocationDetails(node);
}

function showLocationDetails(node) {
    // The Fog of War overlay is now a static paper texture in CSS, so no dynamic background update is needed here.

    // Update UI
    locTitle.textContent = node.title;
    locDesc.textContent = node.desc;
    
    // If it's visited, hide the primary "Ready to go" button to indicate history
    if(node.status === 'visited') {
        btnReady.style.display = 'none';
        document.querySelector('.card-header .tag').textContent = 'Visited';
        document.querySelector('.card-header .tag').style.color = 'var(--text-secondary)';
        document.querySelector('.card-header .tag').style.borderColor = 'var(--text-secondary)';
    } else {
        btnReady.style.display = 'flex';
        document.querySelector('.card-header .tag').textContent = 'New Discovery';
        document.querySelector('.card-header .tag').style.color = 'var(--accent-vintage)';
        document.querySelector('.card-header .tag').style.borderColor = 'var(--accent-vintage)';
    }
    
    idlePrompt.classList.add('hidden');
    locationCard.classList.remove('hidden');
}

function completeCurrentLocation() {
    const node = state.nodes[state.currentNodeIndex];
    node.status = 'visited';
    
    state.placesVisited++;
    updateProgress();
    
    renderNodes();

    locationCard.classList.add('hidden');
    idlePrompt.classList.remove('hidden');
}

function updateProgress() {
    // 3 places = 1 badge
    const badgeCount = Math.floor(state.placesVisited / 3); 
    
    // Fill progress bar (progress to next badge)
    const progress = (state.placesVisited % 3) / 3 * 100;
    progressFill.style.width = `${progress === 0 && state.placesVisited > 0 ? 100 : progress}%`;

    // Update HUD badges
    for(let i=0; i < badgeCount && i < badges.length; i++) {
        badges[i].classList.remove('locked');
        badges[i].style.transform = 'scale(1.3)';
        setTimeout(() => {
            badges[i].style.transform = 'scale(1)';
        }, 300);
    }
    
    // Update Profile Modal badges
    const profileBadges = document.querySelectorAll('.badge-item');
    for(let i=0; i < badgeCount && i < profileBadges.length; i++) {
        profileBadges[i].classList.remove('locked');
    }
    
    // Add to history list in profile
    const currentNode = state.nodes[state.currentNodeIndex];
    if (state.placesVisited > 0) {
        document.querySelector('.history-empty') && document.querySelector('.history-empty').classList.add('hidden');
        
        const li = document.createElement('li');
        li.className = 'history-item';
        
        // Format time dynamically for immersion
        const now = new Date();
        const timeString = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        li.innerHTML = `
            <span class="history-date">Today, ${timeString}</span>
            <span class="history-name">${currentNode.title}</span>
        `;
        // Prepend so newest is on top
        historyList.insertBefore(li, historyList.firstChild);
    }
}

// Run
window.addEventListener('DOMContentLoaded', () => {
    init();
    hideGoogleWatermarks();
});
