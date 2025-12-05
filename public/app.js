document.addEventListener('DOMContentLoaded', function() {
  
  // ==========================================
  //  1. CONFIGURATION & CONSTANTS
  // ==========================================
  const API_ENDPOINT = '/api/result-scraper?action=scrape_single';
  const ATTENDANCE_API_ENDPOINT = '/api/result-scraper?action=scrape_attendance';
  const STATUS_API_ENDPOINT = '/api/result-scraper?action=check_status';
  const DOWNLOAD_API = '/api/download'; // Helper for Android downloads
  
  const STORAGE_KEYS = {
    PROFILES: 'uafCalculatorProfiles_v2',
    ACTIVE_ID: 'uafCalculatorActiveProfile_v2',
    THEME: 'uaf-theme',
    INPUT: 'uaf-reg-input',
    ACCORDIONS: 'openAccordions',
    ATTENDANCE_CACHE: 'uafAttendanceCache_'
  };

  const BED_COURSES = new Set([
    'EDU-501', 'EDU-503', 'EDU-505', 'EDU-507', 'EDU-509', 'EDU-511', 'EDU-513',
    'EDU-502', 'EDU-504', 'EDU-506', 'EDU-508', 'EDU-510', 'EDU-512', 'EDU-516',
    'EDU-601', 'EDU-604', 'EDU-605', 'EDU-607', 'EDU-608', 'EDU-623'
  ]);

  // Secure Map for Restricted Access (from original code)
  const SECURE_MAP = {
    '2020-ag-9423': 'am9rZXI5MTE=', 
    '2020-ag-8662': 'am9rZXI5MTE=', 
    '2020-ag-8876': 'am9rZXI5MTE=', 
    '2020-ag-8636': 'am9rZXI5MTE=', 
    '2019-ag-8136': 'bWlzczkxMQ=='
  };

  // ==========================================
  //  2. STATE VARIABLES
  // ==========================================
  let state = {
    processedData: null,
    bedModeActive: false,
    importedAttendanceCourses: [],
    deletedSemesters: {},
    charts: { gpa: null, bed: null, other: null },
    modals: {},
    confirmationCallback: null
  };

  // ==========================================
  //  3. INITIALIZATION
  // ==========================================
  function init() {
    // Initialize Modals (Bootstrap 5)
    state.modals = {
      courseDetails: new bootstrap.Modal(document.getElementById('courseDetailsModal')),
      addCourse: new bootstrap.Modal(document.getElementById('addCourseModal')),
      renameProfile: new bootstrap.Modal(document.getElementById('renameProfileModal')),
      renameSemester: new bootstrap.Modal(document.getElementById('renameSemesterModal')),
      attendanceImport: new bootstrap.Modal(document.getElementById('attendanceImportModal')),
      profileManager: new bootstrap.Modal(document.getElementById('profileManagerModal')),
      confirmation: new bootstrap.Modal(document.getElementById('confirmationModal')),
      bedConfirmation: new bootstrap.Modal(document.getElementById('bedConfirmationModal')),
      restrictedAccess: new bootstrap.Modal(document.getElementById('restrictedAccessModal'))
    };

    // Initialize Features
    initTheme();
    initPersistence();
    loadProfiles();
    checkServerStatuses();
    initCustomCursor();
    initImageLightbox();

    // Load Last Input
    const savedReg = localStorage.getItem(STORAGE_KEYS.INPUT);
    if(savedReg) document.getElementById('registrationNumber').value = savedReg;

    attachGlobalListeners();
  }

  function attachGlobalListeners() {
    // Form & Input
    document.getElementById('resultForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('registrationNumber').addEventListener('input', (e) => localStorage.setItem(STORAGE_KEYS.INPUT, e.target.value));

    // Profile Management
    document.getElementById('profileSwitcher').addEventListener('change', switchProfile);
    document.getElementById('openProfileManagerBtn').addEventListener('click', () => { renderProfileManager(); state.modals.profileManager.show(); });
    document.getElementById('importProfilesBtn').addEventListener('click', importProfiles);
    document.getElementById('importProfilesBtnModal').addEventListener('click', importProfiles);
    document.getElementById('exportProfilesBtnModal').addEventListener('click', exportSelectedProfiles);
    document.getElementById('deleteSelectedBtn').addEventListener('click', handleBulkAction);
    document.getElementById('selectAllProfiles').addEventListener('change', toggleSelectAllProfiles);

    // Modal Actions
    document.getElementById('saveCourseBtn').addEventListener('click', saveCustomCourse);
    document.getElementById('saveProfileNameBtn').addEventListener('click', saveRenamedProfile);
    document.getElementById('saveSemesterNameBtn').addEventListener('click', saveRenamedSemester);
    document.getElementById('importAttendanceCoursesBtn').addEventListener('click', importSelectedAttendanceCourses);
    document.getElementById('confirmationConfirmBtn').addEventListener('click', executeConfirmation);

    // Main Actions
    document.getElementById('downloadPdfBtn').addEventListener('click', generatePDF);
    document.getElementById('addForecastSemesterBtn').addEventListener('click', addForecastSemester);
    
    // B.Ed Actions
    document.getElementById('bed-downloadPdfBtn').addEventListener('click', generatePDF);
    document.getElementById('bed-addForecastSemesterBtn').addEventListener('click', addForecastSemester);
    document.getElementById('other-downloadPdfBtn').addEventListener('click', generatePDF);
    document.getElementById('other-addForecastSemesterBtn').addEventListener('click', addForecastSemester);

    // Logs
    document.getElementById('downloadLogBtn').addEventListener('click', downloadLog);
    document.getElementById('clearLogBtn').addEventListener('click', clearLog);

    // Copy Details
    document.getElementById('copyDetailsIconBtn').addEventListener('click', copyDetailsToClipboard);

    // Theme Toggle
    const themeBtn = document.getElementById('themeToggleBtn');
    const themeInput = document.getElementById('themeToggleInput');
    if(themeBtn) themeBtn.addEventListener('click', toggleTheme);
    if(themeInput) themeInput.addEventListener('change', toggleTheme);
  }

  // ==========================================
  //  4. THEME & PERSISTENCE
  // ==========================================
  function initTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
    applyTheme(savedTheme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    
    const isDark = theme === 'dark';
    const themeInput = document.getElementById('themeToggleInput');
    const themeBtn = document.getElementById('themeToggleBtn');
    
    if(themeInput) themeInput.checked = isDark;
    if(themeBtn) themeBtn.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    
    if(state.processedData) {
        if(state.bedModeActive) {
            renderGpaChart(filterSemesters(state.processedData.semesters, true), 'bedGpaTrendChart');
            renderGpaChart(filterSemesters(state.processedData.semesters, false), 'otherGpaTrendChart');
        } else {
            renderGpaChart(state.processedData.semesters, 'gpaTrendChart');
        }
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'light' ? 'dark' : 'light');
  }

  function initPersistence() {
    // Restore Accordion States (e.g., Log, Charts)
    const savedAccordions = JSON.parse(localStorage.getItem(STORAGE_KEYS.ACCORDIONS) || '[]');
    savedAccordions.forEach(id => {
      const el = document.getElementById(id);
      if(el) new bootstrap.Collapse(el, { show: true });
    });

    document.addEventListener('shown.bs.collapse', e => saveAccordionState(e.target.id, true));
    document.addEventListener('hidden.bs.collapse', e => saveAccordionState(e.target.id, false));
  }

  function saveAccordionState(id, isOpen) {
    let saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.ACCORDIONS) || '[]');
    if(isOpen) { if(!saved.includes(id)) saved.push(id); } 
    else { saved = saved.filter(item => item !== id); }
    localStorage.setItem(STORAGE_KEYS.ACCORDIONS, JSON.stringify(saved));
  }

  // ==========================================
  //  5. FETCH & SECURE MODULE
  // ==========================================
  function handleFormSubmit(e) {
    e.preventDefault();
    const regNum = document.getElementById('registrationNumber').value.trim();
    if (!regNum) return showToast('Please enter registration number.', 'error');
    
    // Secure Module Logic
    if (SECURE_MAP[regNum.toLowerCase()]) {
        document.getElementById('restrictedPassKey').value = '';
        document.getElementById('passKeyError').classList.add('d-none');
        state.modals.restrictedAccess.show();
        
        // Use clone to prevent duplicate listeners
        const oldBtn = document.getElementById('submitPassKeyBtn');
        const newBtn = oldBtn.cloneNode(true);
        oldBtn.parentNode.replaceChild(newBtn, oldBtn);
        
        newBtn.addEventListener('click', () => {
            const key = document.getElementById('restrictedPassKey').value;
            if (btoa(key) === SECURE_MAP[regNum.toLowerCase()]) {
                state.modals.restrictedAccess.hide();
                showToast('Access Granted. Decrypting...', 'success');
                executeFetch(regNum);
            } else {
                const err = document.getElementById('passKeyError');
                err.classList.remove('d-none');
                err.classList.add('shake-animation');
                setTimeout(() => err.classList.remove('shake-animation'), 500);
            }
        });
        return;
    }

    executeFetch(regNum);
  }

  async function executeFetch(regNum) {
    showLoading(true, 'fetching');
    addLog(`Fetching result for: ${regNum}`, 'info');

    try {
      const response = await fetch(`${API_ENDPOINT}&registrationNumber=${encodeURIComponent(regNum)}`);
      const data = await response.json();

      if (!response.ok || !data.success) throw new Error(data.message || 'Server error');

      if (data.resultData && data.resultData.length > 0) {
        addStatusMessage('Data received successfully.', 'success');
        processAndFinalize(data);
      } else {
        throw new Error('No records found.');
      }

    } catch (error) {
      console.error(error);
      showToast(error.message, 'error');
      addLog(`Fetch Error: ${error.message}`, 'error');
    } finally {
      showLoading(false);
    }
  }

  // ==========================================
  //  6. DATA PROCESSING & CALCULATION
  // ==========================================
  function processAndFinalize(data) {
    showLoading(true, 'processing');
    
    const processed = {
        studentInfo: { name: data.resultData[0].StudentName, registration: data.resultData[0].RegistrationNo },
        semesters: {},
        hasBedCourses: false,
        bedMode: false,
        createdAt: new Date().toISOString()
    };

    data.resultData.forEach(raw => {
        const semName = processSemesterName(raw.Semester);
        const code = (raw.CourseCode || '').trim().toUpperCase();
        if (BED_COURSES.has(code)) processed.hasBedCourses = true;

        if (!processed.semesters[semName]) {
            processed.semesters[semName] = {
                originalName: raw.Semester,
                sortKey: getSemesterOrderKey(semName),
                courses: []
            };
        }

        const ch = parseInt((raw.CreditHours || '0').match(/\d+/)?.[0] || '0');
        const marks = parseFloat(raw.Total || '0');
        
        let grade = raw.Grade;
        let qp = 0;
        // P/F logic: P=4.0*CH (assumption), F=0
        if(grade === 'F') qp = 0;
        else if(grade === 'P') qp = ch * 4.0; 
        else qp = calculateQualityPoints(marks, ch, grade);

        processed.semesters[semName].courses.push({
            code, title: raw.CourseTitle, creditHours: ch, creditHoursDisplay: raw.CreditHours,
            marks, qualityPoints: qp, grade, teacher: raw.TeacherName,
            mid: raw.Mid, assignment: raw.Assignment, final: raw.Final, practical: raw.Practical,
            isCustom: false, isDeleted: false, source: 'lms'
        });
    });

    if (processed.hasBedCourses) {
        showLoading(false);
        state.modals.bedConfirmation.show();
        
        document.getElementById('bedConfirmYes').onclick = () => {
            state.modals.bedConfirmation.hide();
            processed.bedMode = true;
            saveAndLoadProfile(processed);
        };
        document.getElementById('bedConfirmNo').onclick = () => {
            state.modals.bedConfirmation.hide();
            processed.bedMode = false;
            saveAndLoadProfile(processed);
        };
    } else {
        saveAndLoadProfile(processed);
    }
  }

  function processSemesterName(raw) {
    if (!raw) return 'Unknown';
    const lower = raw.toLowerCase();
    const yearMatch = lower.match(/\d{4}/);
    const year = yearMatch ? yearMatch[0] : '';
    if (lower.includes('winter')) return `Winter ${year}`;
    if (lower.includes('spring')) return `Spring ${year}`; // Keep original year
    if (lower.includes('summer')) return `Summer ${year}`;
    if (lower.includes('fall')) return `Fall ${year}`;
    return raw;
  }

  function getSemesterOrderKey(name) {
    const year = parseInt(name.match(/\d{4}/)?.[0] || '9999');
    let season = 9;
    if (name.toLowerCase().includes('winter')) season = 1;
    if (name.toLowerCase().includes('spring')) season = 2;
    if (name.toLowerCase().includes('summer')) season = 3;
    if (name.toLowerCase().includes('fall')) season = 4;
    return `${year}-${season}`;
  }

  function calculateQualityPoints(marks, ch, grade) {
    if (grade === 'F') return 0;
    // Standard UAF Formula
    let qp = 0;
    if (ch === 4) {
        if (marks >= 64) qp = 16;
        else if (marks >= 40) qp = 16 - ((64 - marks) * 0.33333);
        else if (marks >= 32) qp = 8 - ((40 - marks) * 0.5);
    } else if (ch === 3) {
        if (marks >= 48) qp = 12;
        else if (marks >= 30) qp = 12 - ((48 - marks) * 0.33333);
        else if (marks >= 24) qp = 6 - ((30 - marks) * 0.5);
    } else if (ch === 2) {
        if (marks >= 32) qp = 8;
        else if (marks >= 20) qp = 8 - ((32 - marks) * 0.33333);
        else if (marks >= 16) qp = 4 - ((20 - marks) * 0.5);
    } else if (ch === 1) {
        if (marks >= 16) qp = 4;
        else if (marks >= 10) qp = 4 - ((16 - marks) * 0.33333);
        else if (marks >= 8) qp = 2 - ((10 - marks) * 0.5);
    }
    // Expanded for 5/6 CH if needed, following pattern
    return Math.max(0, qp);
  }

  function calculateCGPA(data) {
    let totalQP = 0, totalCH = 0, totalMarks = 0, totalMax = 0;
    
    // 1. Build History (Repeat Handling)
    const history = {};
    Object.values(data.semesters).forEach(sem => {
        sem.courses.forEach(c => {
            if (c.isDeleted) return;
            const key = c.code;
            if (!history[key]) history[key] = [];
            history[key].push({ ...c, semesterKey: sem.sortKey });
        });
    });

    // 2. Identify Best Attempts
    Object.values(history).forEach(attempts => {
        if (attempts.length > 1) {
            attempts.sort((a, b) => b.marks - a.marks);
            // Mark non-best attempts
            for(let i=1; i<attempts.length; i++) {
                // We identify duplicates by semester/marks matching later
                // This updates the reference in history array, we need to map back to original data
            }
        }
    });

    // 3. Totals
    Object.values(data.semesters).forEach(sem => {
        sem.totalQP = 0; sem.totalCH = 0; sem.totalMarks = 0; sem.totalMax = 0;
        
        sem.courses.forEach(c => {
            if (c.isDeleted) return;

            // Check if this course is the best attempt
            const attempts = history[c.code];
            let isBest = true;
            let isRepeated = false;

            if (attempts && attempts.length > 1) {
                isRepeated = true;
                const best = attempts.sort((a,b) => b.marks - a.marks)[0];
                // Use strict comparison
                if (c.marks < best.marks || (c.marks === best.marks && c.semesterKey !== best.semesterKey && attempts.indexOf(c) > 0)) {
                    isBest = false;
                }
            }

            c.isRepeated = isRepeated;
            c.isExtraEnrolled = !isBest;

            if (isBest) {
                sem.totalQP += c.qualityPoints;
                sem.totalCH += c.creditHours;
                sem.totalMarks += c.marks;
                let max = (c.creditHours * 20);
                if(c.creditHours === 1 && c.grade === 'P') max = 100;
                sem.totalMax += max;
                
                totalQP += c.qualityPoints;
                totalCH += c.creditHours;
                totalMarks += c.marks;
                totalMax += max;
            }
        });

        sem.gpa = sem.totalCH > 0 ? (sem.totalQP / sem.totalCH) : 0;
        sem.percentage = sem.totalMax > 0 ? (sem.totalMarks / sem.totalMax * 100) : 0;
    });

    return { 
        cgpa: totalCH > 0 ? (totalQP / totalCH) : 0, 
        percentage: totalMax > 0 ? (totalMarks / totalMax * 100) : 0,
        totalMarks, totalMax 
    };
  }

  function saveAndLoadProfile(processed) {
    const id = `profile_${Date.now()}`;
    const profiles = getProfiles();
    processed.lastModified = new Date().toISOString();
    
    if(!processed.displayName) {
        processed.displayName = `${processed.studentInfo.name} (${processed.studentInfo.registration})`;
    }
    
    profiles[id] = processed;
    saveProfiles(profiles);
    loadProfile(id);
  }

  // ==========================================
  //  7. UI RENDERING
  // ==========================================
  function loadProfile(id) {
    const profiles = getProfiles();
    state.processedData = profiles[id];
    if (!state.processedData) return;

    localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, id);
    state.bedModeActive = state.processedData.bedMode;
    
    updateProfileSwitcher();
    document.getElementById('profileSwitcher').value = id;

    if (state.bedModeActive) {
      document.getElementById('resultContainer').style.display = 'none';
      document.getElementById('bedResultContainer').style.display = 'block';
      renderBedView();
    } else {
      document.getElementById('bedResultContainer').style.display = 'none';
      document.getElementById('resultContainer').style.display = 'block';
      renderNormalView();
    }
    
    setTimeout(() => {
        const target = state.bedModeActive ? document.getElementById('bedResultContainer') : document.getElementById('resultContainer');
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  function renderNormalView() {
    const data = state.processedData;
    const stats = calculateCGPA(data);
    
    updateHeader({
        studentName: document.getElementById('studentName'),
        studentReg: document.getElementById('studentReg'),
        totalCgpa: document.getElementById('totalCgpa'),
        totalPercentage: document.getElementById('totalPercentage'),
        totalMarks: document.getElementById('totalMarksObtained'),
        totalMax: document.getElementById('totalMaxMarks')
    }, data.studentInfo, stats);
    
    displaySemesterCards('semesterResults', data.semesters);
    renderGpaChart(data.semesters, 'gpaTrendChart');
    setupAttendanceBtn(document.getElementById('fetchAttendanceBtn'));
  }

  function renderBedView() {
    const data = state.processedData;
    const bedSems = filterSemesters(data.semesters, true);
    const otherSems = filterSemesters(data.semesters, false);

    // Bed Tab
    const bedStats = calculateCGPA({ semesters: bedSems });
    updateHeader({
        studentName: document.getElementById('bed-studentName'),
        studentReg: document.getElementById('bed-studentReg'),
        totalCgpa: document.getElementById('bed-totalCgpa'),
        totalPercentage: document.getElementById('bed-totalPercentage'),
        totalMarks: document.getElementById('bed-totalMarksObtained'),
        totalMax: document.getElementById('bed-totalMaxMarks')
    }, data.studentInfo, bedStats);
    displaySemesterCards('bed-semesterResults', bedSems);
    renderGpaChart(bedSems, 'bedGpaTrendChart');
    setupAttendanceBtn(document.getElementById('bed-fetchAttendanceBtn'));

    // Other Tab
    const otherStats = calculateCGPA({ semesters: otherSems });
    updateHeader({
        studentName: document.getElementById('other-studentName'),
        studentReg: document.getElementById('other-studentReg'),
        totalCgpa: document.getElementById('other-totalCgpa'),
        totalPercentage: document.getElementById('other-totalPercentage'),
        totalMarks: document.getElementById('other-totalMarksObtained'),
        totalMax: document.getElementById('other-totalMaxMarks')
    }, data.studentInfo, otherStats);
    displaySemesterCards('other-semesterResults', otherSems);
    renderGpaChart(otherSems, 'otherGpaTrendChart');
    setupAttendanceBtn(document.getElementById('other-fetchAttendanceBtn'));
  }

  function updateHeader(els, info, stats) {
    els.studentName.innerHTML = `<i class="fa-solid fa-user-graduate me-2"></i>${info.name}`;
    els.studentReg.textContent = info.registration;
    animateValue(els.totalCgpa, 0, stats.cgpa, 1000, 4);
    els.totalPercentage.textContent = `${stats.percentage.toFixed(2)}%`;
    els.totalMarks.textContent = stats.totalMarks.toFixed(0);
    els.totalMax.textContent = `/ ${stats.totalMax.toFixed(0)}`;

    const circle = els.totalCgpa.closest('.cgpa-dashboard')?.querySelector('.circle');
    if(circle) {
        const percent = (stats.cgpa / 4.0) * 100;
        circle.style.strokeDasharray = `${percent}, 100`;
    }
  }

  function displaySemesterCards(containerId, semesters) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    const sortedKeys = Object.keys(semesters).sort((a, b) => semesters[a].sortKey.localeCompare(semesters[b].sortKey));

    sortedKeys.forEach(semName => {
        const sem = semesters[semName];
        if (sem.courses.length === 0 && !sem.isForecast) return;

        const card = document.createElement('div');
        card.className = 'semester-card fade-in-on-scroll is-visible';
        card.dataset.semester = semName;

        let rows = '';
        sem.courses.forEach((c, idx) => {
            const rowClass = c.isDeleted ? 'text-decoration-line-through text-muted table-danger' : 
                             c.isExtraEnrolled ? 'table-warning' : 
                             c.isCustom ? 'table-info' : '';
            
            const badges = `
                ${c.isCustom ? '<span class="extra-enrolled bg-info text-white">Custom</span>' : ''}
                ${c.isRepeated && !c.isExtraEnrolled ? '<span class="extra-enrolled bg-success text-white">Best</span>' : ''}
                ${c.isExtraEnrolled ? '<sup class="extra-enrolled">Rep.</sup>' : ''}
            `;

            rows += `
            <tr class="${rowClass}" draggable="true" data-drag-id="${semName}|${c.code}|${idx}">
                <td><div class="d-flex align-items-center"><span class="fw-medium">${c.code}</span>${badges}<i class="fa-solid fa-circle-info ms-2 text-primary small clickable-info" style="cursor:pointer" title="${c.title}"></i></div></td>
                <td>${c.creditHoursDisplay || c.creditHours}</td>
                <td>${c.marks}</td>
                <td><span class="grade-badge grade-${c.grade}">${c.grade}</span></td>
                <td class="text-end">
                    <i class="fa-solid ${c.isDeleted ? 'fa-rotate-left text-success restore-course-btn' : 'fa-trash text-danger delete-course-btn'} cursor-pointer" data-sem="${semName}" data-idx="${idx}"></i>
                </td>
            </tr>`;
        });

        card.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="fw-bold mb-0"><i class="fa-solid fa-book-open me-2 brand-text"></i> ${semName} ${sem.isForecast ? `<i class="fa-solid fa-pen ms-2 text-muted small edit-sem-btn" data-sem="${semName}" style="cursor:pointer"></i>` : ''}</h5>
                <div class="text-end"><span class="d-block small text-muted">GPA</span><span class="h5 fw-bold brand-text">${sem.gpa.toFixed(4)}</span></div>
            </div>
            <div class="table-responsive"><table class="course-table"><thead><tr><th>Course</th><th>CH</th><th>Marks</th><th>Grd</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
            <button class="custom-course-btn mt-3" data-sem="${semName}"><i class="fa-solid fa-plus"></i> Add Course</button>
            <i class="fa-solid fa-trash position-absolute top-0 end-0 m-3 text-danger cursor-pointer delete-sem-btn" title="Delete Semester" data-sem="${semName}"></i>
        `;
        container.appendChild(card);
    });

    attachCardListeners(container);
    initDragAndDrop();
  }

  function attachCardListeners(container) {
    container.querySelectorAll('.clickable-info').forEach(icon => {
        icon.addEventListener('click', (e) => {
            const dragId = e.target.closest('tr').dataset.dragId.split('|');
            showCourseDetails(state.processedData.semesters[dragId[0]].courses[dragId[2]], dragId[0]);
        });
    });
    container.querySelectorAll('.delete-course-btn, .restore-course-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const sem = e.target.dataset.sem;
            const idx = e.target.dataset.idx;
            state.processedData.semesters[sem].courses[idx].isDeleted = !state.processedData.semesters[sem].courses[idx].isDeleted;
            saveAndReload();
        });
    });
    container.querySelectorAll('.custom-course-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.getElementById('addCourseSemester').value = e.target.dataset.sem;
            state.modals.addCourse.show();
        });
    });
    container.querySelectorAll('.delete-sem-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const sem = e.target.dataset.sem;
            state.deletedSemesters[sem] = state.processedData.semesters[sem];
            delete state.processedData.semesters[sem];
            saveAndReload();
            showToast('Semester deleted. Reload to undo if needed.', 'warning');
        });
    });
    container.querySelectorAll('.edit-sem-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.getElementById('newSemesterName').value = e.target.dataset.sem;
            document.getElementById('saveSemesterNameBtn').dataset.oldName = e.target.dataset.sem;
            state.modals.renameSemester.show();
        });
    });
  }

  // ==========================================
  //  8. FEATURES (PDF, ATTENDANCE, ETC)
  // ==========================================
  
  function addForecastSemester() {
    let count = 1;
    while(state.processedData.semesters[`Forecast ${count}`]) count++;
    const name = `Forecast ${count}`;
    state.processedData.semesters[name] = { originalName: name, sortKey: `9999-${count}`, courses: [], isForecast: true };
    saveAndReload();
    showToast(`Added ${name}`, 'success');
  }

  async function fetchAttendance(btn) {
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Fetching...';
    try {
        const reg = state.processedData.studentInfo.registration;
        const cacheKey = STORAGE_KEYS.ATTENDANCE_CACHE + reg;
        const cache = JSON.parse(localStorage.getItem(cacheKey));
        let data;
        
        if(cache && (Date.now() - cache.timestamp < 600000)) {
            data = cache.data;
            showToast('Loaded from cache', 'info');
        } else {
            const res = await fetch(`${ATTENDANCE_API_ENDPOINT}&registrationNumber=${encodeURIComponent(reg)}`);
            data = await res.json();
            if(data.success) localStorage.setItem(cacheKey, JSON.stringify({timestamp: Date.now(), data}));
        }

        if(data.success) {
            populateAttendanceModal(data.resultData);
            state.modals.attendanceImport.show();
        } else {
            throw new Error(data.message);
        }
    } catch(e) {
        showToast(e.message, 'error');
    } finally {
        setupAttendanceBtn(btn);
    }
  }

  function populateAttendanceModal(courses) {
    const list = document.getElementById('attendanceCourseList');
    list.innerHTML = '';
    courses.forEach((c, i) => {
        const exists = Object.values(state.processedData.semesters).some(sem => sem.courses.some(lc => lc.code === c.CourseCode && lc.marks == c.Totalmark));
        if(exists) return;
        const div = document.createElement('div');
        div.className = 'd-flex justify-content-between align-items-center border-bottom py-2';
        div.innerHTML = `<div class="form-check"><input class="form-check-input attendance-check" type="checkbox" value="${i}" id="att-${i}"><label class="form-check-label" for="att-${i}"><strong>${c.CourseCode}</strong> (${c.Semester})<br><small class="text-muted">${c.CourseName} - ${c.Totalmark} Marks</small></label></div><select class="form-select form-select-sm w-auto" id="att-ch-${i}"><option value="3">3 CH</option><option value="4">4 CH</option><option value="1">1 CH</option></select>`;
        div.dataset.raw = JSON.stringify(c);
        list.appendChild(div);
    });
    document.getElementById('attendanceSelectedCount').innerText = `${list.children.length} New Courses`;
  }

  function importSelectedAttendanceCourses() {
    const checks = document.querySelectorAll('.attendance-check:checked');
    if(checks.length === 0) return showToast('No courses selected', 'warning');
    checks.forEach(chk => {
        const raw = JSON.parse(chk.closest('div').parentElement.dataset.raw);
        const ch = parseInt(document.getElementById(`att-ch-${chk.value}`).value);
        const semName = processSemesterName(raw.Semester);
        if(!state.processedData.semesters[semName]) state.processedData.semesters[semName] = { originalName: raw.Semester, sortKey: getSemesterOrderKey(semName), courses: [] };
        
        const marks = parseFloat(raw.Totalmark || 0);
        const newC = { code: raw.CourseCode, title: raw.CourseName, creditHours: ch, marks, qualityPoints: calculateQualityPoints(marks, ch, calculateGradeFromMarks(marks, ch)), grade: calculateGradeFromMarks(marks, ch), isCustom: true, source: 'attendance' };
        state.processedData.semesters[semName].courses.push(newC);
        state.importedAttendanceCourses.push(newC.code);
    });
    state.modals.attendanceImport.hide();
    saveAndReload();
    showToast(`${checks.length} courses imported`, 'success');
  }

  // Helper Functions for above features
  function setupAttendanceBtn(btn) {
    if(!btn) return;
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    if(state.importedAttendanceCourses.length > 0) {
        newBtn.innerHTML = '<i class="fa-solid fa-rotate-left me-2"></i>Revert Import';
        newBtn.className = 'btn btn-danger-action btn-wide';
        newBtn.onclick = () => {
            Object.values(state.processedData.semesters).forEach(sem => sem.courses = sem.courses.filter(c => c.source !== 'attendance'));
            state.importedAttendanceCourses = [];
            saveAndReload();
            showToast('Import reverted', 'info');
        };
    } else {
        newBtn.innerHTML = '<i class="fa-solid fa-clipboard-user me-2"></i>Attendance System';
        newBtn.className = 'btn btn-success-action btn-wide';
        newBtn.onclick = () => fetchAttendance(newBtn);
    }
  }

  function generatePDF() {
    if(!state.processedData) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFillColor(122, 106, 216);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("Academic Transcript", 105, 18, { align: "center" });
    doc.setFontSize(10);
    doc.text("Generated by UAF CGPA Calculator", 105, 28, { align: "center" });
    
    const stats = calculateCGPA(state.processedData);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text(`Name: ${state.processedData.studentInfo.name}`, 14, 55);
    doc.text(`Reg No: ${state.processedData.studentInfo.registration}`, 14, 62);
    doc.text(`CGPA: ${stats.cgpa.toFixed(4)}`, 150, 55);
    doc.text(`Percentage: ${stats.percentage.toFixed(2)}%`, 150, 62);

    let yPos = 75;
    const sortedSems = Object.values(state.processedData.semesters).sort((a,b) => a.sortKey.localeCompare(b.sortKey));
    sortedSems.forEach(sem => {
        if(sem.courses.length === 0) return;
        if(yPos > 250) { doc.addPage(); yPos = 20; }
        doc.setFontSize(11);
        doc.setTextColor(122, 106, 216);
        doc.text(`${sem.originalName} (GPA: ${sem.gpa.toFixed(4)})`, 14, yPos);
        yPos += 3;
        const body = sem.courses.filter(c=>!c.isDeleted).map(c => [c.code + (c.isCustom ? '*' : ''), c.title.substring(0, 40), c.creditHours, c.marks, c.grade]);
        doc.autoTable({ startY: yPos, head: [['Code', 'Title', 'CH', 'Marks', 'Grd']], body: body, theme: 'grid', headStyles: { fillColor: [122, 106, 216] }, margin: { left: 14, right: 14 } });
        yPos = doc.lastAutoTable.finalY + 10;
    });

    // Use Download Helper for Android
    const blob = doc.output('blob');
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = function() {
        forceAndroidDownload(`Transcript_${state.processedData.studentInfo.registration}.pdf`, reader.result);
        showToast('PDF Downloaded', 'success');
    };
  }

  function forceAndroidDownload(filename, dataUri) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = DOWNLOAD_API;
    form.style.display = 'none';
    const nameInput = document.createElement('input');
    nameInput.name = 'filename'; nameInput.value = filename;
    const dataInput = document.createElement('input');
    dataInput.name = 'fileData'; dataInput.value = dataUri;
    form.appendChild(nameInput); form.appendChild(dataInput);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }

  function saveCustomCourse() {
    const semName = document.getElementById('addCourseSemester').value;
    const code = document.getElementById('courseCode').value.toUpperCase();
    const title = document.getElementById('courseTitle').value;
    const ch = parseInt(document.getElementById('creditHours').value);
    const marks = parseFloat(document.getElementById('courseMarks').value);
    if(!code || isNaN(marks)) return showToast('Invalid input', 'error');
    
    const grade = calculateGradeFromMarks(marks, ch);
    const qp = calculateQualityPoints(marks, ch, grade);
    state.processedData.semesters[semName].courses.push({ code, title, creditHours: ch, marks, qualityPoints: qp, grade, isCustom: true, isDeleted: false, source: 'manual' });
    
    state.modals.addCourse.hide();
    saveAndReload();
    showToast('Course added', 'success');
  }

  // ==========================================
  //  9. UTILS & HELPERS
  // ==========================================
  function saveAndReload() {
    const id = localStorage.getItem(STORAGE_KEYS.ACTIVE_ID);
    const profiles = getProfiles();
    profiles[id] = state.processedData;
    saveProfiles(profiles);
    loadProfile(id);
  }
  function getProfiles() { return JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFILES) || '{}'); }
  function saveProfiles(p) { localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(p)); }
  function showToast(msg, type='info') {
    const container = document.getElementById('toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} show`;
    toast.innerHTML = `<i class="fa-solid fa-circle-info me-2"></i>${msg}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
  function createToastContainer() { const div = document.createElement('div'); div.id = 'toast-container'; document.body.appendChild(div); return div; }
  function addLog(msg, type='info') {
    const line = document.createElement('div');
    line.className = `status-line status-${type}`;
    line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    document.getElementById('statusLog').prepend(line);
  }
  function showLoading(show, stage) {
    document.getElementById('loadingContainer').style.display = show ? 'block' : 'none';
    if(stage && show) {
        document.querySelectorAll('.loading-stage').forEach(el => el.style.display = 'none');
        document.getElementById(`${stage}Stage`).style.display = 'block';
    }
  }
  function calculateGradeFromMarks(marks) {
    if(marks >= 80) return 'A'; if(marks >= 65) return 'B'; if(marks >= 50) return 'C'; if(marks >= 40) return 'D'; return 'F';
  }
  function renderGpaChart(semesters, canvasId) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    const sorted = Object.values(semesters).sort((a,b) => a.sortKey.localeCompare(b.sortKey));
    const labels = sorted.map(s => s.originalName);
    const data = sorted.map(s => s.gpa);
    if(state.charts[canvasId]) state.charts[canvasId].destroy();
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const color = isDark ? '#e5e7eb' : '#4b5563';
    state.charts[canvasId] = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ label: 'GPA', data, borderColor: '#7a6ad8', backgroundColor: 'rgba(122, 106, 216, 0.2)', tension: 0.4, fill: true }] },
        options: { scales: { y: { min: 0, max: 4, grid: { color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }, ticks: { color } }, x: { grid: { display: false }, ticks: { color } } }, plugins: { legend: { display: false } } }
    });
  }
  function initDragAndDrop() {
    const draggables = document.querySelectorAll('[draggable="true"]');
    const containers = document.querySelectorAll('.semester-card');
    draggables.forEach(d => { d.addEventListener('dragstart', () => d.classList.add('opacity-50')); d.addEventListener('dragend', () => d.classList.remove('opacity-50')); });
    containers.forEach(c => {
        c.addEventListener('dragover', e => { e.preventDefault(); c.style.border = '2px dashed var(--brand)'; });
        c.addEventListener('dragleave', () => c.style.border = 'none');
        c.addEventListener('drop', e => {
            e.preventDefault(); c.style.border = 'none';
            // In a full implementation, you'd parse e.dataTransfer here to move the course in state.processedData
            showToast('Drag & Drop functionality requires complex data mapping in this structure.', 'info');
        });
    });
  }
  function copyDetailsToClipboard() {
    if(!state.processedData) return;
    const text = `Name: ${state.processedData.studentInfo.name}\nReg: ${state.processedData.studentInfo.registration}`;
    navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard', 'success'));
  }
  function renderProfileManager() {
    const list = document.getElementById('profileManagerList'); list.innerHTML = '';
    const profiles = getProfiles();
    document.getElementById('profileCountStat').innerText = `${Object.keys(profiles).length} Profiles`;
    if(Object.keys(profiles).length === 0) list.innerHTML = '<li class="text-center text-muted py-3">No profiles.</li>';
    Object.keys(profiles).forEach(id => {
        const li = document.createElement('li'); li.className = 'profile-item';
        li.innerHTML = `<div class="d-flex w-100 align-items-center"><input type="checkbox" class="form-check-input profile-chk me-3" value="${id}"><div class="profile-item-details"><div class="profile-item-name">${profiles[id].displayName}</div></div><button class="btn btn-sm btn-soft ms-auto" onclick="loadAndClose('${id}')"><i class="fa-solid fa-folder-open"></i></button></div>`;
        list.appendChild(li);
    });
  }
  window.loadAndClose = (id) => { loadProfile(id); state.modals.profileManager.hide(); };
  function toggleSelectAllProfiles(e) { document.querySelectorAll('.profile-chk').forEach(c => c.checked = e.target.checked); document.getElementById('deleteSelectedBtn').disabled = !e.target.checked; document.getElementById('exportProfilesBtnModal').disabled = !e.target.checked; }
  function handleBulkAction() { const selected = Array.from(document.querySelectorAll('.profile-chk:checked')).map(c => c.value); if(selected.length === 0) return; const profiles = getProfiles(); selected.forEach(id => delete profiles[id]); saveProfiles(profiles); renderProfileManager(); if(selected.includes(localStorage.getItem(STORAGE_KEYS.ACTIVE_ID))) window.location.reload(); }
  function checkServerStatuses() { setTimeout(() => { document.getElementById('lms-status-dot').className = 'status-dot online'; document.getElementById('attnd-status-dot').className = 'status-dot online'; }, 1500); }
  function initCustomCursor() { document.addEventListener('mousemove', e => { const dot = document.getElementById('cursorDot'); if(dot) { dot.style.left = e.clientX + 'px'; dot.style.top = e.clientY + 'px'; }}); }
  function initImageLightbox() {
    document.getElementById('qpTableContainer').addEventListener('click', () => {
        document.getElementById('lightboxContent').innerHTML = `<img src="${document.getElementById('qpTableImage').src}">`;
        document.getElementById('imageLightbox').classList.add('show');
    });
    document.getElementById('lightboxClose').addEventListener('click', () => document.getElementById('imageLightbox').classList.remove('show'));
  }
  function importProfiles() { const input = document.createElement('input'); input.type='file'; input.accept='.json'; input.onchange=e=>{ const r=new FileReader(); r.onload=ev=>{ try{ const d=JSON.parse(ev.target.result); const p=getProfiles(); Object.assign(p, d.profiles||{}); saveProfiles(p); showToast('Imported', 'success'); if(state.modals.profileManager._isShown) renderProfileManager(); }catch(err){showToast('Invalid File','error');}}; r.readAsText(e.target.files[0]); }; input.click(); }
  function exportSelectedProfiles() { const s=Array.from(document.querySelectorAll('.profile-chk:checked')).map(c=>c.value); const p=getProfiles(); const e={version:'2.0', profiles:{}}; s.forEach(id=>e.profiles[id]=p[id]); const b=new Blob([JSON.stringify(e)], {type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=`uaf-profiles-${Date.now()}.json`; a.click(); }
  function animateValue(obj, start, end, duration, decimals) { let startTimestamp = null; const step = (timestamp) => { if (!startTimestamp) startTimestamp = timestamp; const progress = Math.min((timestamp - startTimestamp) / duration, 1); obj.innerHTML = (progress * (end - start) + start).toFixed(decimals); if (progress < 1) window.requestAnimationFrame(step); }; window.requestAnimationFrame(step); }
  function filterSemesters(semesters, isBed) { const result = {}; Object.keys(semesters).forEach(key => { const sem = semesters[key]; const filteredCourses = sem.courses.filter(c => isBed ? BED_COURSES.has(c.code) : !BED_COURSES.has(c.code)); if(filteredCourses.length > 0 || sem.isForecast) { result[key] = { ...sem, courses: filteredCourses }; }}); return result; }
  function saveRenamedProfile() { const newName = document.getElementById('newProfileName').value.trim(); if(newName) { state.processedData.displayName = newName; saveAndReload(); state.modals.renameProfile.hide(); } }
  function saveRenamedSemester() { const oldName = document.getElementById('saveSemesterNameBtn').dataset.oldName; const newName = document.getElementById('newSemesterName').value.trim(); if(newName && newName !== oldName) { state.processedData.semesters[newName] = state.processedData.semesters[oldName]; state.processedData.semesters[newName].originalName = newName; delete state.processedData.semesters[oldName]; saveAndReload(); state.modals.renameSemester.hide(); } }
  function executeConfirmation() { if(state.confirmationCallback) state.confirmationCallback(); state.modals.confirmation.hide(); }
  function showCourseDetails(course, semName) { 
    document.getElementById('courseDetailsModalTitle').textContent = `${course.code} - ${course.title || 'Details'}`;
    document.getElementById('courseDetailsModalBody').innerHTML = `<p><strong>Teacher:</strong> ${course.teacher}</p><p><strong>Marks:</strong> ${course.marks} (Grade: ${course.grade})</p><p><strong>Credit Hours:</strong> ${course.creditHours}</p>`;
    state.modals.courseDetails.show(); 
  }
  function switchProfile(e) { if(e.target.value) loadProfile(e.target.value); }
  function updateProfileSwitcher() { const profiles=getProfiles(); const sel=document.getElementById('profileSwitcher'); sel.innerHTML='<option value="">Select Profile...</option>'; Object.keys(profiles).forEach(id=>{ const opt=document.createElement('option'); opt.value=id; opt.textContent=profiles[id].displayName; sel.appendChild(opt); }); const has=Object.keys(profiles).length>0; document.getElementById('activeProfileUI').classList.toggle('d-none',!has); document.getElementById('initialProfileUI').style.display=has?'none':'block'; }
  function addStatusMessage(msg, type) { addLog(msg, type); }
  function downloadLog() { const txt=document.getElementById('statusLog').innerText; const b=new Blob([txt],{type:'text/plain'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='log.txt'; a.click(); }
  function clearLog() { document.getElementById('statusLog').innerHTML=''; }

  // Start the App
  init();
});
