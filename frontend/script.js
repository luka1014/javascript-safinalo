
const API = 'http://localhost:3000/api';
let currentEventId = null;


window.addEventListener('DOMContentLoaded', () => {
    // ბოლო search-ის აღდგენა localStorage-იდან (ბონუს ფუნქცია)
    const savedSearch    = localStorage.getItem('lastSearch')   || '';
    const savedCategory  = localStorage.getItem('lastCategory') || '';
    if (savedSearch)   document.getElementById('searchInput').value    = savedSearch;
    if (savedCategory) document.getElementById('categorySelect').value = savedCategory;

    loadEvents();
});


async function loadEvents() {
    const search   = document.getElementById('searchInput').value.trim();
    const category = document.getElementById('categorySelect').value;
    const sort     = document.querySelector('.sort-tabs .tab.active').dataset.sort;
    const when     = document.querySelector('.when-tabs .when-tab.active').dataset.when;

    // ბოლო search localStorage-ში
    localStorage.setItem('lastSearch',   search);
    localStorage.setItem('lastCategory', category);

    showLoading();

    try {
        const params = new URLSearchParams();
        if (search)   params.append('search',   search);
        if (category) params.append('category', category);
        if (sort)     params.append('sort',     sort);
        if (when)     params.append('when',     when);

        const res    = await fetch(`${API}/events?${params}`);
        const events = await res.json();

        updateStats(events);
        renderEvents(events);

    } catch (err) {
        showConnectionError();
    }
}

// ─── RENDER EVENTS ───
function renderEvents(events) {
    const grid       = document.getElementById('eventsGrid');
    const emptyState = document.getElementById('emptyState');
    grid.innerHTML   = '';

    if (events.length === 0) {
        emptyState.style.display = 'flex';
        return;
    }
    emptyState.style.display = 'none';

    events.forEach((event, index) => {
        const isFull  = event.spotsLeft <= 0;
        const isLow   = !isFull && event.spotsLeft <= 5;
        const card    = document.createElement('div');
        card.className = `card ${isFull ? 'card-full' : ''}`;
        card.style.setProperty('--delay', `${index * 0.1}s`);

        card.innerHTML = `
            <div class="card-image">
                <img src="${getCategoryImage(event.category)}" alt="${event.category}" loading="lazy">
                <div class="card-overlay"></div>
                ${getBadgeHTML(event.category, isFull)}
                ${isLow ? `<div class="card-img-footer">
                    <span class="seats-left"><i class="fas fa-fire"></i> ${event.spotsLeft} ადგილი დარჩა</span>
                </div>` : ''}
            </div>
            <div class="card-content">
                <span class="date ${isFull ? 'date-muted' : ''}">
                    <i class="far fa-calendar-alt"></i> ${formatDate(event.date)}
                    ${event.time ? `&nbsp;· <i class="far fa-clock"></i> ${event.time}` : ''}
                </span>
                <h3>${event.title}</h3>
                <p>${event.description || 'აღწერა არ არის'}</p>
                <div class="card-meta">
                    <span><i class="fas fa-map-marker-alt"></i> ${event.location || '—'}</span>
                    <span><i class="fas fa-users"></i> ${event.registeredCount || 0} / ${event.capacity}</span>
                </div>
                <div class="card-footer">
                    <a class="btn-outline card-detail-link" href="event.html?id=${event.id}">დეტალები</a>
                    ${isFull
                        ? `<span class="full-label"><i class="fas fa-lock"></i> სავსეა</span>
                           <button type="button" class="btn-disabled" disabled>სავსეა</button>`
                        : `<button type="button" class="btn-outline" onclick="openModal(${event.id}, '${escapeStr(event.title)}')">
                               რეგისტრაცია
                           </button>`
                    }
                </div>
            </div>
        `;
        grid.appendChild(card);
    });


    const observer = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.1 });
    document.querySelectorAll('.card').forEach(c => observer.observe(c));
}


function openModal(eventId, eventTitle) {
    currentEventId = eventId;

    // reset
    document.getElementById('regForm').reset();
    document.getElementById('regForm').style.display        = 'block';
    document.getElementById('successState').style.display   = 'none';
    document.getElementById('errorDuplicate').style.display = 'none';
    document.getElementById('errorCapacity').style.display  = 'none';
    document.getElementById('errorGeneral').style.display   = 'none';
    document.getElementById('emailWrap').classList.remove('has-error');
    document.getElementById('modalEventTitle').textContent  = eventTitle;

    document.getElementById('modal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
    document.body.style.overflow = '';
    currentEventId = null;
}

function handleOverlayClick(e) {
    if (e.target === e.currentTarget) closeModal();
}


async function handleSubmit(e) {
    e.preventDefault();

    document.getElementById('errorDuplicate').style.display = 'none';
    document.getElementById('errorCapacity').style.display  = 'none';
    document.getElementById('errorGeneral').style.display   = 'none';
    document.getElementById('emailWrap').classList.remove('has-error');

    const submitBtn     = document.getElementById('submitBtn');
    submitBtn.disabled  = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> გაგზავნა...';

    try {
        const res  = await fetch(`${API}/events/${currentEventId}/register`, {
            method  : 'POST',
            headers : { 'Content-Type': 'application/json' },
            body    : JSON.stringify({
                fullName : document.getElementById('inputName').value.trim(),
                email    : document.getElementById('inputEmail').value.trim(),
                phone    : document.getElementById('inputPhone').value.trim(),
            })
        });

        const data = await res.json();

        if (res.ok) {
            document.getElementById('regForm').style.display      = 'none';
            document.getElementById('successState').style.display = 'block';
            document.getElementById('confirmationCode').textContent = data.confirmationCode;
            loadEvents(); 

        } else {
            if (data.error === 'duplicate_email') {
                document.getElementById('errorDuplicate').style.display = 'flex';
                document.getElementById('emailWrap').classList.add('has-error');
            } else if (data.error === 'capacity_full') {
                document.getElementById('errorCapacity').style.display = 'flex';
            } else {
                document.getElementById('errorGeneralText').textContent = data.message || 'დაფიქსირდა შეცდომა';
                document.getElementById('errorGeneral').style.display   = 'flex';
            }
        }

    } catch (err) {
        document.getElementById('errorGeneralText').textContent = 'სერვერთან კავშირი ვერ მოხერხდა';
        document.getElementById('errorGeneral').style.display   = 'flex';
    } finally {
        submitBtn.disabled  = false;
        submitBtn.innerHTML = '<span>დადასტურება</span><i class="fas fa-arrow-right"></i>';
    }
}

document.querySelectorAll('.sort-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.sort-tabs .tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        loadEvents();
    });
});

document.querySelectorAll('.when-tabs .when-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.when-tabs .when-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        loadEvents();
    });
});

document.getElementById('searchInput').addEventListener('keyup', e => {
    if (e.key === 'Enter') loadEvents();
});

function resetSearch() {
    document.getElementById('searchInput').value    = '';
    document.getElementById('categorySelect').value = '';
    localStorage.removeItem('lastSearch');
    localStorage.removeItem('lastCategory');
    loadEvents();
}

function updateStats(events) {
    const today    = new Date().toISOString().split('T')[0];
    const upcoming = events.filter(e => e.date >= today).length;
    document.getElementById('statTotal').textContent    = events.length;
    document.getElementById('statUpcoming').textContent = upcoming;
    document.getElementById('eventCount').textContent   = `${events.length} ღონისძიება`;
}

function showLoading() {
    document.getElementById('eventsGrid').innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>ღონისძიებები იტვირთება...</p>
        </div>`;
    document.getElementById('emptyState').style.display = 'none';
}

function showConnectionError() {
    document.getElementById('eventsGrid').innerHTML = `
        <div class="error-state">
            <i class="fas fa-plug"></i>
            <h3>სერვერთან კავშირი ვერ მოხერხდა</h3>
            <p>დარწმუნდი რომ backend მუშაობს: <code>node server.js</code></p>
        </div>`;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const months = ['იანვარი','თებერვალი','მარტი','აპრილი','მაისი','ივნისი',
                    'ივლისი','აგვისტო','სექტემბერი','ოქტომბერი','ნოემბერი','დეკემბერი'];
    const d = new Date(dateStr);
    return `${d.getDate()} ${months[d.getMonth()]}, ${d.getFullYear()}`;
}

function getBadgeHTML(category, isFull) {
    if (isFull) return `<div class="badge badge-red">სავსეა</div>`;
    const colors = { Tech: '', Design: 'badge-amber', Business: 'badge-green', Art: 'badge-red' };
    return `<div class="badge ${colors[category] || ''}">${category || 'სხვა'}</div>`;
}

function getCategoryImage(category) {
    const imgs = {
        Tech     : 'https://images.unsplash.com/photo-1540575861501-7cf05a4b125a?auto=format&fit=crop&w=800',
        Design   : 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=800',
        Business : 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=800',
        Art      : 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=800',
    };
    return imgs[category] || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800';
}

function escapeStr(str) {
    return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}