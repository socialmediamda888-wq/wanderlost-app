let map;
window.initMap = function() {
    map = new google.maps.Map(document.getElementById('map-bg'), {
        center: { lat: 47.3769, lng: 8.5417 },
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
    isSubscribed: false
};

// DOM Elements
const nodesContainer = document.getElementById('nodes-container');
const trailSvg = document.getElementById('trail-svg');
const fogOverlay = document.getElementById('fog-overlay');
const locationCard = document.getElementById('location-card');
const idlePrompt = document.getElementById('idle-prompt');
const locTitle = document.getElementById('loc-title');
const locDesc = document.getElementById('loc-desc');
const progressFill = document.querySelector('.progress-fill');
const badges = document.querySelectorAll('.badges-mini i');
const mapBg = document.getElementById('map-bg');

// Buttons
const btnReady = document.getElementById('ready-btn');
const btnScan = document.getElementById('scan-btn');
const btnSettings = document.getElementById('settings-btn');
const modalSub = document.getElementById('subscription-modal');
const btnCloseSub = modalSub.querySelector('.close-btn');
const btnSubscribeNow = document.getElementById('subscribe-now-btn');

const modalCheckout = document.getElementById('checkout-modal');
const btnCloseCheckout = modalCheckout.querySelector('.close-btn');
const btnConfirmPayment = document.getElementById('confirm-payment-btn');

const modalProfile = document.getElementById('profile-modal');
const btnCloseProfile = modalProfile.querySelector('.close-btn');

const modalLegal = document.getElementById('legal-modal');
const btnCloseLegal = modalLegal.querySelector('.close-btn');

const btnOpenProfile = document.querySelector('.user-profile .avatar'); // Specifically target the clickable avatar box
const historyList = document.querySelector('.history-list');

const btnStartJourney = document.getElementById('start-journey-btn');
const modalWelcome = document.getElementById('welcome-modal');

// Initialize
function init() {
    renderNodes();
    
    // Simulate panning on start
    setTimeout(() => {
        mapBg.classList.add('map-panning');
    }, 100);

    // Event Listeners
    btnStartJourney.addEventListener('click', () => {
        modalWelcome.style.opacity = '0';
        setTimeout(() => {
            modalWelcome.classList.add('hidden');
            
            // Auto-trigger the first location after a dramatic pause
            setTimeout(() => {
                btnScan.click(); // Simulate clicking the scan button to start
            }, 500);
        }, 1000); // Wait for fade out
    });

    btnScan.addEventListener('click', () => {
        btnScan.disabled = true;
        btnScan.innerHTML = '<i class="fa-solid fa-filter fa-spin"></i> Verifying Authenticity...';
        
        setTimeout(() => {
            btnScan.innerHTML = '<i class="fa-solid fa-microchip fa-spin"></i> Analyzing Cultural Signals...';
            
            setTimeout(() => {
                revealNextNode();
                btnScan.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Initiate Scan';
                btnScan.disabled = false;
            }, 1800);
        }, 1500);
    });

    btnReady.addEventListener('click', () => {
        const node = state.nodes[state.currentNodeIndex];
        
        // Use coordinates or fallback to Zurich center for demo
        const lat = node.lat || 47.3769; 
        const lng = node.lng || 8.5417;
        const encodedName = encodeURIComponent(node.title);
        
        let mapUrl = '';
        
        // Basic OS checking for deep linking
        if ((navigator.platform.indexOf("iPhone") !== -1) || 
            (navigator.platform.indexOf("iPad") !== -1) || 
            (navigator.platform.indexOf("iPod") !== -1)) {
            // Apple Maps
            mapUrl = `http://maps.apple.com/?q=${encodedName}&ll=${lat},${lng}`;
        } else {
            // Google Maps
            mapUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        }

        // Open in new tab which triggers native app deep-links on mobile
        window.open(mapUrl, '_blank');
        
        completeCurrentLocation();
    });

    let previousModalForCheckout = null;

    btnSettings.addEventListener('click', () => {
        if(state.isSubscribed) {
            alert("You are already a Wanderløst Elite member! Manage your subscription from your Profile Dossier.");
        } else {
            modalSub.classList.remove('hidden');
        }
    });

    btnCloseSub.addEventListener('click', () => {
        modalSub.classList.add('hidden');
    });
    
    // Trigger Checkout
    btnSubscribeNow.addEventListener('click', () => {
        previousModalForCheckout = modalSub;
        modalSub.classList.add('hidden');
        modalCheckout.classList.remove('hidden');
    });

    // Profile Modal Events
    btnOpenProfile.addEventListener('click', () => {
        modalProfile.classList.remove('hidden');
    });

    btnCloseProfile.addEventListener('click', () => {
        modalProfile.classList.add('hidden');
    });
    
    // Legal Modal Events
    btnCloseLegal.addEventListener('click', () => {
        modalLegal.classList.add('hidden');
    });
    
    // Checkout Modal Events
    btnCloseCheckout.addEventListener('click', () => {
        modalCheckout.classList.add('hidden');
        if (previousModalForCheckout) {
            previousModalForCheckout.classList.remove('hidden');
        }
    });
    
    // Simulated Payment Processing
    btnConfirmPayment.addEventListener('click', () => {
        const btnText = btnConfirmPayment.querySelector('.btn-text');
        const spinner = btnConfirmPayment.querySelector('.btn-spinner');
        
        // Basic Validation (Mock)
        const form = document.getElementById('checkout-form');
        if(!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        // Show Loading State
        btnText.textContent = 'Processing...';
        spinner.classList.remove('hidden');
        btnConfirmPayment.disabled = true;

        // Simulate Network Request
        setTimeout(() => {
            // Success State
            btnText.textContent = 'Payment Successful';
            spinner.classList.add('hidden');
            state.isSubscribed = true;
            
            // Close after brief success delay
            setTimeout(() => {
                modalCheckout.classList.add('hidden');
                previousModalForCheckout = null;
                alert("Welcome to Wanderløst Elite! Your location discovery limits have been lifted.");
                
                // Reset button for future reference
                btnConfirmPayment.disabled = false;
                btnText.textContent = 'Pay 20.00 CHF';
            }, 800);
        }, 2000);
    });
    
    // Wire up dummy payments/terms buttons purely for visual feel closing
    document.getElementById('manage-payments-btn').addEventListener('click', () => {
        if(state.isSubscribed) {
             alert("Current Plan: Wanderløst Elite\nStatus: Active\nNext Billing Date: " + new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString());
        } else {
             previousModalForCheckout = modalProfile;
             modalProfile.classList.add('hidden');
             modalCheckout.classList.remove('hidden'); // Lead directly to checkout as convenience
        }
    });
    
    document.getElementById('terms-btn').addEventListener('click', () => {
        modalProfile.classList.add('hidden');
        modalLegal.classList.remove('hidden');
    });
    
    // Danger Actions (Mocked)
    document.getElementById('cancel-membership-btn').addEventListener('click', () => {
        if(confirm("Are you sure you want to cancel Wanderløst Elite? You will lose access to detailed locations and badges at the end of your billing cycle.")) {
            alert("Membership cancellation requested. You will receive an email confirmation shortly.");
        }
    });
    
    document.getElementById('delete-data-btn').addEventListener('click', () => {
        if(confirm("DANGER: Are you sure you want to delete your entire Wanderløst account and all travel trail history? This action is permanent and cannot be undone.")) {
            alert("Data deletion request received. All history and vector profiles are being purged. The app will now reload.");
            window.location.reload();
        }
    });
    
    // Clear the dummy HTML history on init so it's accurate to the state
    historyList.innerHTML = `<p class="history-empty hidden">No secrets uncovered yet.</p>`;
    
    // Set Dynamic Renewal Date for compliance
    const renewalEl = document.getElementById('dynamic-renewal-date');
    if(renewalEl) {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        renewalEl.textContent = d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    }

    // Collapse Card Logic
    const btnCollapse = document.getElementById('collapse-btn');
    btnCollapse.addEventListener('click', () => {
        locationCard.classList.toggle('is-collapsed');
    });
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
        
        // Click to view active or visited locations
        el.addEventListener('click', () => {
            if (node.status === 'active' || node.status === 'visited') {
                showLocationDetails(node);
            }
        });
        
        nodesContainer.appendChild(el);
    });
    
    drawTrails();
}

function drawTrails() {
    trailSvg.innerHTML = '';
    
    const visitedNodes = state.nodes.filter(n => n.status === 'visited' || n.status === 'active');
    if (visitedNodes.length < 2) return;

    let pathD = '';
    for (let i = 0; i < visitedNodes.length - 1; i++) {
        const start = visitedNodes[i];
        const end = visitedNodes[i+1];
        
        // Convert % to pixels roughly based on container size for the SVG path
        // Using % for SVG elements requires viewBox logic, so we'll just set paths using percentages
        // Actually, SVG paths don't support percentages natively in "d" attribute in the same way,
        // so we'll map them relative to a 100x100 viewbox.
        
        if (i === 0) {
            pathD += `M ${start.x} ${start.y} `;
        }
        
        // Add a slight curve (bezier)
        const midX = (start.x + end.x) / 2 + (Math.random() * 10 - 5);
        const midY = (start.y + end.y) / 2 + (Math.random() * 10 - 5);
        
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
