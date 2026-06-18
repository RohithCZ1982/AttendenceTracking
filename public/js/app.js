let currentStream = null;
let pendingAttendanceType = null;
let currentEmployeeDetailId = null;

// --- Toast ---
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const content = document.getElementById('toast-content');
  content.textContent = message;
  content.className = 'px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium max-w-sm ' +
    (type === 'error' ? 'bg-red-500' : type === 'warning' ? 'bg-yellow-500' : 'bg-green-500');
  toast.classList.remove('hidden');
  toast.classList.remove('toast-hide');
  toast.classList.add('toast-show');
  setTimeout(() => {
    toast.classList.remove('toast-show');
    toast.classList.add('toast-hide');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 3000);
}

function showLoading(text = 'Processing...') {
  document.getElementById('loading-text').textContent = text;
  document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loading').classList.add('hidden');
}

// --- Navigation ---
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.getElementById(pageId).classList.remove('hidden');
}

// --- Login ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const mobile = document.getElementById('login-mobile').value.trim();
  const pin = document.getElementById('login-pin').value.trim();

  if (!/^\d{10}$/.test(mobile)) return showToast('Enter a valid 10-digit mobile number', 'error');
  if (!/^\d{6}$/.test(pin)) return showToast('Enter a valid 6-digit PIN', 'error');

  showLoading('Signing in...');
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile, pin })
    });
    const data = await res.json();
    hideLoading();

    if (!res.ok) return showToast(data.error, 'error');

    if (data.isAdmin) {
      showPage('page-admin');
      document.getElementById('admin-date').textContent = formatDate(new Date());
      loadEmployees();
    } else {
      showPage('page-employee');
      document.getElementById('emp-name').textContent = data.name;
      document.getElementById('emp-date').textContent = formatDate(new Date());
      loadTodaySummary();
    }
  } catch (err) {
    hideLoading();
    showToast('Connection error. Please try again.', 'error');
  }
});

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  document.getElementById('login-mobile').value = '';
  document.getElementById('login-pin').value = '';
  showPage('page-login');
}

// --- Employee: Attendance ---
async function loadTodaySummary() {
  try {
    const res = await fetch('/api/attendance/today');
    const data = await res.json();
    if (!res.ok) return;

    document.getElementById('total-hours').textContent = data.totalHours.toFixed(2);

    const btnIn = document.getElementById('btn-checkin');
    const btnOut = document.getElementById('btn-checkout');
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const statusDetail = document.getElementById('status-detail');

    if (data.currentStatus === 'checkin') {
      statusDot.className = 'w-3 h-3 rounded-full bg-green-500 animate-pulse';
      statusText.textContent = 'Currently Checked In';
      statusText.className = 'text-sm font-medium text-green-600';
      statusDetail.textContent = 'Since ' + formatTime(new Date(data.lastTime));
      btnIn.disabled = true;
      btnOut.disabled = false;
    } else if (data.currentStatus === 'checkout') {
      statusDot.className = 'w-3 h-3 rounded-full bg-gray-400';
      statusText.textContent = 'Checked Out';
      statusText.className = 'text-sm font-medium text-gray-600';
      statusDetail.textContent = 'Last checkout at ' + formatTime(new Date(data.lastTime));
      btnIn.disabled = false;
      btnOut.disabled = true;
    } else {
      statusDot.className = 'w-3 h-3 rounded-full bg-gray-400';
      statusText.textContent = 'Not checked in yet';
      statusText.className = 'text-sm font-medium text-gray-500';
      statusDetail.textContent = 'Tap Check In to start';
      btnIn.disabled = false;
      btnOut.disabled = true;
    }

    const recordsDiv = document.getElementById('today-records');
    if (data.records.length === 0) {
      recordsDiv.innerHTML = '<p class="text-gray-400 text-sm text-center py-2">No records today</p>';
    } else {
      recordsDiv.innerHTML = data.records.map(r => `
        <div class="record-item record-${r.type} pl-3 py-2 rounded-r-lg">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-xs font-medium ${r.type === 'checkin' ? 'text-green-600' : 'text-red-600'} uppercase">
                ${r.type === 'checkin' ? 'Check In' : 'Check Out'}
              </span>
              <span class="text-sm text-gray-700 ml-2">${formatTime(new Date(r.timestamp))}</span>
            </div>
            ${r.latitude ? `<span class="text-xs text-gray-400">${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}</span>` : ''}
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load summary:', err);
  }
}

async function startAttendance(type) {
  pendingAttendanceType = type;

  showLoading('Getting your location...');
  try {
    const position = await getLocation();
    hideLoading();
    openCamera(position);
  } catch (err) {
    hideLoading();
    showToast('Location access is required. Please enable it.', 'error');
  }
}

function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy
      }),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

async function openCamera(position) {
  window._pendingPosition = position;
  const modal = document.getElementById('camera-modal');
  const video = document.getElementById('camera-video');

  try {
    currentStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
    });
    video.srcObject = currentStream;
    modal.classList.remove('hidden');
  } catch (err) {
    showToast('Camera access is required. Please enable it.', 'error');
  }
}

function closeCamera() {
  const modal = document.getElementById('camera-modal');
  modal.classList.add('hidden');
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
    currentStream = null;
  }
}

async function capturePhoto() {
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0);

  const rawDataUrl = canvas.toDataURL('image/jpeg', 0.9);

  closeCamera();
  showLoading('Compressing photo...');

  try {
    const compressedPhoto = await PhotoCompressor.compress(rawDataUrl);
    document.getElementById('loading-text').textContent = 'Saving attendance...';

    const position = window._pendingPosition;
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: pendingAttendanceType,
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        photo: compressedPhoto
      })
    });

    const data = await res.json();
    hideLoading();

    if (!res.ok) {
      showToast(data.error, 'error');
    } else {
      showToast(data.message);
      loadTodaySummary();
    }
  } catch (err) {
    hideLoading();
    showToast('Failed to save attendance. Please try again.', 'error');
  }
}

// --- Admin ---
async function loadEmployees() {
  try {
    const res = await fetch('/api/admin/employees');
    const employees = await res.json();
    if (!res.ok) return;

    const list = document.getElementById('employee-list');
    if (employees.length === 0) {
      list.innerHTML = '<p class="text-gray-400 text-center py-4">No employees found</p>';
      return;
    }

    list.innerHTML = employees.map(emp => {
      const statusColor = emp.currentStatus === 'checkin' ? 'green' : emp.currentStatus === 'checkout' ? 'gray' : 'gray';
      const statusLabel = emp.currentStatus === 'checkin' ? 'Checked In' : emp.currentStatus === 'checkout' ? 'Checked Out' : 'No activity';
      return `
        <div class="bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition cursor-pointer"
             onclick="openEmployeeDetail(${emp.id})">
          <div class="flex items-center justify-between">
            <div>
              <h4 class="font-medium text-gray-800">${escapeHtml(emp.name)}</h4>
              <p class="text-sm text-gray-500">${emp.mobile}</p>
            </div>
            <div class="text-right">
              <p class="text-lg font-bold text-blue-600">${emp.totalHoursToday.toFixed(2)}h</p>
              <div class="flex items-center gap-1.5 justify-end">
                <div class="w-2 h-2 rounded-full bg-${statusColor}-500 ${statusColor === 'green' ? 'animate-pulse' : ''}"></div>
                <span class="text-xs text-${statusColor}-600">${statusLabel}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    showToast('Failed to load employees', 'error');
  }
}

async function openEmployeeDetail(empId) {
  currentEmployeeDetailId = empId;
  document.getElementById('admin-employee-list').classList.add('hidden');
  document.getElementById('admin-employee-detail').classList.remove('hidden');

  const monthSelect = document.getElementById('detail-month');
  const yearSelect = document.getElementById('detail-year');
  const now = new Date();

  if (monthSelect.options.length === 0) {
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    months.forEach((m, i) => {
      const opt = document.createElement('option');
      opt.value = i + 1;
      opt.textContent = m;
      monthSelect.appendChild(opt);
    });
    for (let y = now.getFullYear(); y >= now.getFullYear() - 2; y--) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      yearSelect.appendChild(opt);
    }
  }

  monthSelect.value = now.getMonth() + 1;
  yearSelect.value = now.getFullYear();

  loadEmployeeDetail();
}

async function loadEmployeeDetail() {
  const empId = currentEmployeeDetailId;
  const month = document.getElementById('detail-month').value;
  const year = document.getElementById('detail-year').value;

  try {
    const res = await fetch(`/api/admin/employee/${empId}?month=${month}&year=${year}`);
    const data = await res.json();
    if (!res.ok) return showToast(data.error, 'error');

    document.getElementById('detail-header').innerHTML = `
      <h3 class="text-lg font-semibold text-gray-800">${escapeHtml(data.employee.name)}</h3>
      <p class="text-sm text-gray-500">${data.employee.mobile}</p>
    `;

    const attDiv = document.getElementById('detail-attendance');
    if (data.attendance.length === 0) {
      attDiv.innerHTML = '<p class="text-gray-400 text-center py-6">No attendance records for this month</p>';
    } else {
      attDiv.innerHTML = data.attendance.map(day => `
        <div class="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div class="bg-gray-50 px-4 py-2 flex items-center justify-between border-b">
            <span class="font-medium text-gray-700 text-sm">${formatDateStr(day.date)}</span>
            <span class="text-sm font-semibold text-blue-600">${day.hoursWorked.toFixed(2)}h</span>
          </div>
          <div class="p-3 space-y-2">
            ${day.records.map(r => `
              <div class="record-item record-${r.type} pl-3 py-1.5 rounded-r-lg flex items-center justify-between">
                <div class="flex items-center gap-2">
                  ${r.photo ? `<img src="${r.photo}" class="photo-thumb" onclick="showPhoto(this.src)" alt="Photo">` : '<div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center"><svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg></div>'}
                  <div>
                    <span class="text-xs font-medium ${r.type === 'checkin' ? 'text-green-600' : 'text-red-600'} uppercase">
                      ${r.type === 'checkin' ? 'In' : 'Out'}
                    </span>
                    <span class="text-sm text-gray-700 ml-1">${formatTime(new Date(r.timestamp))}</span>
                  </div>
                </div>
                ${r.latitude ? `<span class="text-xs text-gray-400 hidden sm:inline">${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `).join('');
    }

    document.getElementById('detail-monthly-total').innerHTML = `
      <p class="text-sm text-gray-600">Monthly Total</p>
      <p class="text-3xl font-bold text-blue-600">${data.monthlyTotalHours.toFixed(2)} hours</p>
    `;
  } catch (err) {
    showToast('Failed to load details', 'error');
  }
}

function showEmployeeList() {
  document.getElementById('admin-employee-list').classList.remove('hidden');
  document.getElementById('admin-employee-detail').classList.add('hidden');
  loadEmployees();
}

// --- Add Employee ---
function showAddEmployee() {
  document.getElementById('add-employee-modal').classList.remove('hidden');
}

function closeAddEmployee() {
  document.getElementById('add-employee-modal').classList.add('hidden');
  document.getElementById('add-employee-form').reset();
}

document.getElementById('add-employee-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('new-emp-name').value.trim();
  const mobile = document.getElementById('new-emp-mobile').value.trim();
  const pin = document.getElementById('new-emp-pin').value.trim();

  if (!name || name.length < 2) return showToast('Enter a valid name', 'error');
  if (!/^\d{10}$/.test(mobile)) return showToast('Enter a valid 10-digit mobile', 'error');
  if (!/^\d{6}$/.test(pin)) return showToast('Enter a valid 6-digit PIN', 'error');

  showLoading('Adding employee...');
  try {
    const res = await fetch('/api/admin/employee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mobile, pin })
    });
    const data = await res.json();
    hideLoading();

    if (!res.ok) return showToast(data.error, 'error');

    showToast('Employee added successfully');
    closeAddEmployee();
    loadEmployees();
  } catch (err) {
    hideLoading();
    showToast('Failed to add employee', 'error');
  }
});

// --- Photo Modal ---
function showPhoto(src) {
  document.getElementById('photo-modal-img').src = src;
  document.getElementById('photo-modal').classList.remove('hidden');
}

function closePhotoModal() {
  document.getElementById('photo-modal').classList.add('hidden');
}

// --- Utilities ---
function formatTime(date) {
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDate(date) {
  return date.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateStr(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- Session Check on Load ---
(async function checkSession() {
  try {
    const res = await fetch('/api/session');
    const data = await res.json();
    if (data.authenticated) {
      if (data.isAdmin) {
        showPage('page-admin');
        document.getElementById('admin-date').textContent = formatDate(new Date());
        loadEmployees();
      } else {
        showPage('page-employee');
        document.getElementById('emp-date').textContent = formatDate(new Date());
        loadTodaySummary();
      }
    }
  } catch (err) {
    // Stay on login page
  }
})();
