document.addEventListener('DOMContentLoaded', function() {

  // ==========================================
  // 1. CONFIGURATION & CONSTANTS
  // ==========================================
  const API_ENDPOINT = `/api/result-scraper?action=scrape_single`;
  const ATTENDANCE_API_ENDPOINT = `/api/result-scraper?action=scrape_attendance`;
  
  const STORAGE_KEYS = {
    PROFILES: 'uafCalculatorProfiles_v2',
    ACTIVE_ID: 'uafCalculatorActiveProfile_v2',
    THEME: 'uaf-theme',
    BACKUP: 'uafCalculatorBackupInfo',
    ATTENDANCE_CACHE: 'uafAttendanceCache_',
    UI_STATE: 'uafUiState' 
  };

  // Courses that identify the B.Ed program
  const BED_COURSES = new Set([
    'EDU-501', 'EDU-503', 'EDU-505', 'EDU-507', 'EDU-509', 'EDU-511', 'EDU-513',
    'EDU-502', 'EDU-504', 'EDU-506', 'EDU-508', 'EDU-510', 'EDU-512', 'EDU-516',
    'EDU-601', 'EDU-604', 'EDU-605', 'EDU-607', 'EDU-608', 'EDU-623'
  ]);

  // ==========================================
  // 2. DOM ELEMENTS
  // ==========================================
  const els = {
    // Inputs & Forms
    form: document.getElementById('resultForm'),
    regInput: document.getElementById('registrationNumber'),
    profileSwitcher: document.getElementById('profileSwitcher'),
    
    // Containers
    resultContainer: document.getElementById('resultContainer'),
    loadingContainer: document.getElementById('loadingContainer'),
    gpaChartContainer: document.getElementById('gpaChartContainer'),
    
    // Buttons (Main)
    fetchAttendanceBtn: document.getElementById('fetchAttendanceBtn'),
    downloadPdfBtn: document.getElementById('downloadPdfBtn'),
    addForecastBtn: document.getElementById('addForecastSemesterBtn'),
    
    // UI Components
    cursorDot: document.getElementById('cursorDot'),
    backToTop: document.getElementById('backToTop'),
    themeToggle: { 
      input: document.getElementById('themeToggleInput'), 
      btn: document.getElementById('themeToggleBtn') 
    },
    
    // Modals (Bootstrap Instances)
    modals: {
      course: new bootstrap.Modal(document.getElementById('courseDetailsModal')),
      addCourse: new bootstrap.Modal(document.getElementById('addCourseModal')),
      renameProfile: new bootstrap.Modal(document.getElementById('renameProfileModal')),
      renameSem: new bootstrap.Modal(document.getElementById('renameSemesterModal')),
      confirm: new bootstrap.Modal(document.getElementById('confirmationModal')),
      manager: new bootstrap.Modal(document.getElementById('profileManagerModal')),
      attendance: new bootstrap.Modal(document.getElementById('attendanceImportModal')),
      bedConfirm: new bootstrap.Modal(document.getElementById('bedConfirmationModal')),
      restricted: new bootstrap.Modal(document.getElementById('restrictedAccessModal'))
    },

    // Display Fields
    display: {
      name: document.getElementById('studentName'),
      reg: document.getElementById('studentReg'),
      cgpa: document.getElementById('totalCgpa'),
      percent: document.getElementById('totalPercentage'),
      marks: document.getElementById('totalMarksObtained'),
      maxMarks: document.getElementById('totalMaxMarks'),
      circle: document.getElementById('cgpaCircle'),
      semResults: document.getElementById('semesterResults'),
      bedContainer: document.getElementById('bedResultContainer')
    }
  };

  // ==========================================
  // 3. STATE MANAGEMENT
  // ==========================================
  let state = {
    processedData: null,
    deletedSemesters: {},
    gpaChart: null,
    bedGpaChart: null,
    otherGpaChart: null,
    bedModeActive: false,
    importedAttendanceCourses: [],
    confirmationCallback: null,
    // Initialize UI state from storage or defaults
    ui: JSON.parse(localStorage.getItem(STORAGE_KEYS.UI_STATE) || '{"gpaChartCollapsed":false, "statusLogCollapsed":true, "activeBedTab":"bed-tab"}')
  };

  // ==========================================
  // 4. INITIALIZATION
  // ==========================================
  function init() {
    initTheme();
    initCustomCursor();
    initBackToTop();
    
    migrateOldProfiles();
    loadProfiles(); // Loads data from localStorage and renders if active profile exists
    
    initScrollAnimations();
    setupEventListeners();
    checkServerStatuses();
    
    // Persistence: Restore UI states after rendering is complete
    // We use a slight delay to ensure DOM elements (like charts) are ready if data was loaded
    setTimeout(restoreUiState, 100);
  }

  // ==========================================
  // 5. PERSISTENCE LAYER
  // ==========================================
  function saveUiState(key, value) {
    state.ui[key] = value;
    localStorage.setItem(STORAGE_KEYS.UI_STATE, JSON.stringify(state.ui));
  }

  function restoreUiState() {
    // 1. Restore collapsed sections
    const chartCollapse = document.getElementById('gpaChartCollapse');
    const logCollapse = document.getElementById('statusLogCollapse');

    if (chartCollapse) {
        if (state.ui.gpaChartCollapsed) {
            chartCollapse.classList.remove('show');
        } else {
            chartCollapse.classList.add('show');
        }
    }

    if (logCollapse) {
        if (state.ui.statusLogCollapsed === false) { 
            logCollapse.classList.add('show');
        } else {
            logCollapse.classList.remove('show');
        }
    }

    // 2. Restore Active B.Ed Tab (if applicable)
    if (state.ui.activeBedTab && state.bedModeActive) {
       const tabBtn = document.querySelector(`#${state.ui.activeBedTab}`);
       if (tabBtn) {
         const tab = new bootstrap.Tab(tabBtn);
         tab.show();
       }
    }
  }

  function initTheme() {
    const applyTheme = (theme) => {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
      if (els.themeToggle.input) els.themeToggle.input.checked = (theme === 'dark');
      if (els.themeToggle.btn) els.themeToggle.btn.innerHTML = `<i class="fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}"></i>`;
    };

    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
    applyTheme(savedTheme);

    const toggle = () => applyTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
    
    if (els.themeToggle.input) els.themeToggle.input.addEventListener('change', toggle);
    if (els.themeToggle.btn) els.themeToggle.btn.addEventListener('click', toggle);
  }

  // ==========================================
  // 6. CORE LOGIC: FETCH & PROCESS
  // ==========================================
  
  // Restricted Access Logic (De-obfuscated for maintainability)
  const RestrictedAccess = {
    // Map of Registration Numbers to Base64 Passkeys
    map: { 
      '2020-ag-9423': 'am9rZXI5MTE=', 
      '2020-ag-8662': 'am9rZXI5MTE=', 
      '2020-ag-8876': 'am9rZXI5MTE=', 
      '2020-ag-8636': 'am9rZXI5MTE=', 
      '2019-ag-8136': 'bWlzczkxMQ==' 
    }, 
    pendingReg: null,
    
    isRestricted: (reg) => {
      return RestrictedAccess.map.hasOwnProperty(reg.toLowerCase());
    },
    
    prompt: (reg) => {
      RestrictedAccess.pendingReg = reg;
      document.getElementById('restrictedPassKey').value = '';
      document.getElementById('passKeyError').style.display = 'none';
      els.modals.restricted.show();
    },
    
    validate: () => {
      const input = document.getElementById('restrictedPassKey').value;
      const expected = RestrictedAccess.map[RestrictedAccess.pendingReg.toLowerCase()];
      
      // Compare Base64 encoded input with stored hash
      if (btoa(input) === expected) {
        els.modals.restricted.hide();
        executeFetch(RestrictedAccess.pendingReg); // Proceed to fetch
      } else {
        const err = document.getElementById('passKeyError');
        err.style.display = 'block';
        const btn = document.getElementById('submitPassKeyBtn');
        setTimeout(() => err.style.display = 'none', 2000);
      }
    }
  };

  async function fetchResult() {
    const regNum = els.regInput.value.trim();
    if (!regNum) return showToast('Please enter a registration number', 'error');

    // Security Check
    if (RestrictedAccess.isRestricted(regNum)) {
      RestrictedAccess.prompt(regNum);
      return;
    }

    executeFetch(regNum);
  }

  async function executeFetch(regNum) {
    showLoadingStage('connecting');
    els.resultContainer.style.display = 'none';
    els.display.bedContainer.style.display = 'none';

    try {
      showLoadingStage('fetching');
      
      // Call Backend API
      const res = await fetch(`${API_ENDPOINT}&registrationNumber=${encodeURIComponent(regNum)}`);
      const data = await res.json();

      if (!res.ok || !data.success) throw new Error(data.message || 'Server Error');

      showLoadingStage('processing');
      
      // Process Data
      const processed = processScrapedData(data);

      // Check for B.Ed
      if (processed.hasBedCourses) {
        els.modals.bedConfirm.show();
        // Setup one-time listeners for the modal choices
        document.getElementById('bedConfirmYes').onclick = () => handleBedConfirm(true, processed);
        document.getElementById('bedConfirmNo').onclick = () => handleBedConfirm(false, processed);
      } else {
        handleBedConfirm(false, processed);
      }

    } catch (err) {
      console.error(err);
      addStatusMessage(`Error: ${err.message}`, 'error');
      showToast(err.message, 'error');
      showLoadingStage(null);
    }
  }

  function handleBedConfirm(isBed, processed) {
    els.modals.bedConfirm.hide();
    
    // Save the preference
    processed.bedMode = isBed;
    state.bedModeActive = isBed;
    
    // Create & Save Profile
    saveNewProfile(processed);
    
    // Update State & UI
    state.processedData = processed;
    renderResults(state.processedData);
    showLoadingStage('complete');
    setTimeout(() => showLoadingStage(null), 1500);
  }

  function processScrapedData(data) {
    const studentInfo = { 
        name: data.resultData[0]?.StudentName || 'Unknown', 
        registration: data.resultData[0]?.RegistrationNo || 'N/A' 
    };
    const semesters = {};
    let hasBedCourses = false;

    data.resultData.forEach(course => {
      const originalName = course.Semester || 'Unknown';
      const semName = processSemesterName(originalName);
      const code = (course.CourseCode || '').trim().toUpperCase();
      
      if (BED_COURSES.has(code)) hasBedCourses = true;

      if (!semesters[semName]) {
        semesters[semName] = {
          originalName: originalName,
          sortKey: getSemesterSortKey(semName),
          courses: []
        };
      }

      const ch = parseInt(course.CreditHours) || 0;
      const marks = parseFloat(course.Total) || 0;
      const grade = course.Grade || 'F';

      semesters[semName].courses.push({
        code: code,
        title: course.CourseTitle || '',
        creditHours: ch,
        creditHoursDisplay: course.CreditHours,
        marks: marks,
        grade: grade,
        qualityPoints: calculateQualityPoints(marks, ch, grade),
        teacher: course.TeacherName || '',
        mid: course.Mid,
        assignment: course.Assignment,
        final: course.Final,
        practical: course.Practical,
        isExtraEnrolled: false, // Calculated later
        isRepeated: false,      // Calculated later
        isDeleted: false,
        isCustom: false,
        originalSemester: originalName
      });
    });

    return { studentInfo, semesters, hasBedCourses };
  }

  // ==========================================
  // 7. CORE LOGIC: CALCULATION
  // ==========================================
  function calculateCGPA(data) {
    if (!data || !data.semesters) return null;
    
    let totalQP = 0, totalCH = 0, totalMarks = 0, totalMax = 0;
    const history = {};

    // 1. Build Course History (to detect repeats)
    Object.values(data.semesters).forEach(sem => {
      sem.courses.forEach(c => {
        if (c.isDeleted) return;
        const key = c.code.toUpperCase().trim();
        if (!history[key]) history[key] = [];
        // Store reference to the course object
        history[key].push({ semSort: sem.sortKey, marks: c.marks, data: c });
      });
    });

    // 2. Mark Repeats (Best attempt logic)
    Object.values(history).forEach(attempts => {
      // Reset flags first
      attempts.forEach(a => { a.data.isRepeated = false; a.data.isExtraEnrolled = false; });

      if (attempts.length > 1) {
        attempts.sort((a, b) => a.semSort.localeCompare(b.semSort)); // Sort by date
        const passed = attempts.filter(a => a.data.grade !== 'F');
        
        // If passed multiple times, take highest marks. If never passed, take highest marks of failed attempts.
        const best = passed.length 
            ? passed.reduce((p, c) => p.marks > c.marks ? p : c) 
            : attempts.reduce((p, c) => p.marks > c.marks ? p : c);
        
        attempts.forEach(a => {
          a.data.isRepeated = true;
          // Mark as extra (don't count) if it's not the best attempt
          a.data.isExtraEnrolled = (a !== best);
        });
      }
    });

    // 3. Summation
    Object.values(data.semesters).forEach(sem => {
      sem.totalQP = 0; sem.totalCH = 0; sem.totalMarks = 0; sem.totalMax = 0;
      
      sem.courses.forEach(c => {
        if (!c.isExtraEnrolled && !c.isDeleted) {
          sem.totalQP += c.qualityPoints;
          sem.totalCH += c.creditHours;
          sem.totalMarks += c.marks;
          
          // Calculate Max Marks for Percentage
          let max = { 10: 200, 9: 180, 8: 160, 7: 140, 6: 120, 5: 100, 4: 80, 3: 60, 2: 40, 1: 20 }[c.creditHours] || 0;
          if (c.grade === 'P' && c.creditHours === 1) max = 100; // Special case for P/F
          
          sem.totalMax += max;
          totalQP += c.qualityPoints; totalCH += c.creditHours; totalMarks += c.marks; totalMax += max;
        }
      });

      // Semester Stats
      sem.gpa = sem.totalCH > 0 ? sem.totalQP / sem.totalCH : 0;
      sem.percentage = sem.totalMax > 0 ? (sem.totalMarks / sem.totalMax) * 100 : 0;
    });

    // 4. Overall Stats
    return {
      cgpa: totalCH > 0 ? totalQP / totalCH : 0,
      percentage: totalMax > 0 ? (totalMarks / totalMax) * 100 : 0,
      totalMarksObtained: totalMarks,
      totalMaxMarks: totalMax,
      totalCreditHours: totalCH
    };
  }

  function calculateQualityPoints(marks, ch, grade) {
    if (grade === 'F') return 0;
    if (grade === 'P') return ch * 4.0; 
    
    // Official Formula Logic matches UAF table logic
    if (ch === 4) {
        if (marks >= 64) return 16;
        if (marks >= 40) return 16 - ((64 - marks) * 0.3333);
        if (marks >= 32) return 8 - ((40 - marks) * 0.5);
    } else if (ch === 3) {
        if (marks >= 48) return 12;
        if (marks >= 30) return 12 - ((48 - marks) * 0.3333);
        if (marks >= 24) return 6 - ((30 - marks) * 0.5);
    } 
    // Fallback/Generic calculation for other CH
    return parseFloat(((marks / (ch * 20)) * ch * 4).toFixed(2));
  }

  // ==========================================
  // 8. RENDERING UI
  // ==========================================
  function renderResults(data) {
    if (!data) return;
    
    // Hide everything first
    els.resultContainer.style.display = 'block';
    
    if (state.bedModeActive) {
      // 1. B.Ed Mode Layout
      els.resultContainer.querySelector('.gpa-result-card-premium').style.display = 'none'; 
      els.display.bedContainer.style.display = 'block';
      
      const bedSemesters = filterSemesters(data.semesters, true);
      const otherSemesters = filterSemesters(data.semesters, false);
      
      // Render Tabs
      renderTabContent('bed', { ...data, semesters: bedSemesters });
      renderTabContent('other', { ...data, semesters: otherSemesters });
      
      // Update Buttons in Tabs
      updateAttendanceButtonForTab('bed');
      updateAttendanceButtonForTab('other');

    } else {
      // 2. Normal Mode Layout
      els.resultContainer.querySelector('.gpa-result-card-premium').style.display = 'block';
      els.display.bedContainer.style.display = 'none';
      
      const stats = calculateCGPA(data);
      updateDisplay(stats, '', data);
      
      // Button Logic
      setupAttendanceButton(els.fetchAttendanceBtn);
    }
    
    // We delay this slightly to ensure the DOM is fully repainted before we try to modify classes
    setTimeout(restoreUiState, 50);
  }

  function renderTabContent(prefix, dataSubset) {
    const stats = calculateCGPA(dataSubset);
    
    // Text Updates
    document.getElementById(`${prefix}-studentName`).innerHTML = `<i class="fa-solid fa-user-graduate me-2"></i>${dataSubset.studentInfo.name}`;
    document.getElementById(`${prefix}-studentReg`).textContent = dataSubset.studentInfo.registration;
    document.getElementById(`${prefix}-totalCgpa`).textContent = stats.cgpa.toFixed(4);
    document.getElementById(`${prefix}-totalPercentage`).textContent = `${stats.percentage.toFixed(2)}%`;
    document.getElementById(`${prefix}-totalMarksObtained`).textContent = stats.totalMarksObtained.toFixed(0);
    document.getElementById(`${prefix}-totalMaxMarks`).textContent = `/ ${stats.totalMaxMarks.toFixed(0)}`;
    
    // Circle Animation
    setTimeout(() => {
        const circle = document.getElementById(`${prefix}-cgpaCircle`);
        if(circle) circle.style.strokeDasharray = `${(stats.cgpa/4)*100}, 100`;
    }, 100);

    // Render Semesters
    const container = document.getElementById(`${prefix}-semesterResults`);
    container.innerHTML = '';
    const sortedKeys = Object.keys(dataSubset.semesters).sort((a,b) => dataSubset.semesters[a].sortKey.localeCompare(dataSubset.semesters[b].sortKey));
    
    sortedKeys.forEach(semName => {
        if(dataSubset.semesters[semName].courses.length > 0) {
            container.appendChild(createSemesterCard(semName, dataSubset.semesters[semName]));
        }
    });
    
    // Render Specific Chart
    renderGpaChart(dataSubset, `${prefix}GpaTrendChart`);
  }

  function updateDisplay(stats, prefix = '', fullData) {
    els.display.name.innerHTML = `<i class="fa-solid fa-user-graduate me-2"></i>${fullData.studentInfo.name}`;
    els.display.reg.textContent = fullData.studentInfo.registration;
    els.display.cgpa.textContent = stats.cgpa.toFixed(4);
    els.display.percent.textContent = `${stats.percentage.toFixed(2)}%`;
    els.display.marks.textContent = stats.totalMarksObtained.toFixed(0);
    els.display.maxMarks.textContent = `/ ${stats.totalMaxMarks.toFixed(0)}`;
    
    setTimeout(() => {
        if(els.display.circle) els.display.circle.style.strokeDasharray = `${(stats.cgpa/4)*100}, 100`;
    }, 100);

    const container = els.display.semResults;
    container.innerHTML = '';
    const sortedKeys = Object.keys(fullData.semesters).sort((a,b) => fullData.semesters[a].sortKey.localeCompare(fullData.semesters[b].sortKey));
    
    sortedKeys.forEach(semName => {
        container.appendChild(createSemesterCard(semName, fullData.semesters[semName]));
    });
    
    renderGpaChart(fullData, 'gpaTrendChart');
  }

  function createSemesterCard(name, semester) {
    const div = document.createElement('div');
    // Using animation class
    div.className = 'semester-card fade-in-on-scroll is-visible'; 
    div.dataset.semester = name;
    
    div.innerHTML = `
      <i class="fa-solid fa-trash delete-semester" data-semester="${name}"></i>
      <div class="d-flex justify-content-between mb-3">
        <h5 class="mb-0">
            <i class="fa-solid fa-book-open me-2 text-primary"></i>${name}
            <i class="fa-solid fa-pencil edit-semester ms-2 text-muted" style="cursor:pointer;font-size:0.8em"></i>
        </h5>
        <div class="text-end">
          <p class="mb-0 text-muted small">GPA</p>
          <p class="mb-0 h4 fw-bold text-primary">${semester.gpa.toFixed(4)}</p>
        </div>
      </div>
      <button class="custom-course-btn mb-2" data-semester="${name}"><i class="fa-solid fa-plus"></i> Custom Course</button>
      <div class="table-responsive">
        <table class="course-table">
          <thead><tr><th>Course</th><th>CH</th><th>Marks</th><th>Grade</th><th>Action</th></tr></thead>
          <tbody>${semester.courses.map((c, i) => `
            <tr class="${c.isExtraEnrolled?'table-warning':''} ${c.isDeleted?'table-danger text-decoration-line-through':''} ${c.isCustom?'table-info':''}">
              <td>
                <span class="fw-medium course-code clickable-info" data-course-idx="${i}" data-sem="${name}">${c.code}</span>
                ${c.isExtraEnrolled ? '<sup class="extra-enrolled">Rep.</sup>' : ''}
                ${c.isCustom ? (c.source === 'attendance' ? '<sup class="extra-enrolled" style="color:#087990;background:#cff4fc;">Atnd.</sup>' : '<span class="extra-enrolled">Custom</span>') : ''}
              </td>
              <td>${c.creditHours}</td><td>${c.marks}</td>
              <td><span class="grade-badge grade-${c.grade}">${c.grade}</span></td>
              <td><i class="fa-solid ${c.isDeleted?'fa-rotate-left restore-course text-success':'fa-trash delete-course text-danger'}" data-sem="${name}" data-idx="${i}"></i></td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>
    `;
    
    // Attach Listeners locally
    div.querySelector('.delete-semester').onclick = () => deleteSemester(name);
    div.querySelector('.custom-course-btn').onclick = () => openAddCourseModal(name);
    div.querySelector('.edit-semester').onclick = () => openRenameSemesterModal(name);
    
    div.querySelectorAll('.clickable-info').forEach(span => {
        span.onclick = () => showCourseDetails(semester.courses[span.dataset.courseIdx]);
    });
    
    div.querySelectorAll('.delete-course, .restore-course').forEach(btn => {
        btn.onclick = () => toggleCourseStatus(name, btn.dataset.idx, btn.classList.contains('delete-course'));
    });
    
    return div;
  }

  // ==========================================
  // 9. PROFILE MANAGER
  // ==========================================
  function saveNewProfile(data) {
    const profiles = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFILES) || '{}');
    const id = `profile_${Date.now()}`;
    
    data.displayName = `${data.studentInfo.name} (${data.studentInfo.registration})`;
    data.lastModified = new Date().toISOString();
    
    profiles[id] = data;
    localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
    localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, id);
    
    loadProfiles(); // Refresh Switcher
  }

  function loadProfiles() {
    const profiles = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFILES) || '{}');
    const activeId = localStorage.getItem(STORAGE_KEYS.ACTIVE_ID);
    
    els.profileSwitcher.innerHTML = '<option value="">Select Profile...</option>';
    
    Object.keys(profiles).forEach(id => {
      const p = profiles[id];
      const opt = document.createElement('option');
      opt.value = id;
      opt.text = p.displayName || p.studentInfo.registration;
      if (id === activeId) opt.selected = true;
      els.profileSwitcher.appendChild(opt);
    });

    if (activeId && profiles[activeId]) {
      state.processedData = profiles[activeId];
      state.bedModeActive = state.processedData.bedMode || false;
      document.getElementById('activeProfileUI').style.display = 'block';
      document.getElementById('initialProfileUI').style.display = 'none';
      renderResults(state.processedData);
    } else {
      document.getElementById('activeProfileUI').style.display = 'none';
      document.getElementById('initialProfileUI').style.display = 'block';
    }
  }

  function saveCurrentProfile() {
    const activeId = localStorage.getItem(STORAGE_KEYS.ACTIVE_ID);
    if (!activeId || !state.processedData) return;
    
    const profiles = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFILES) || '{}');
    state.processedData.lastModified = new Date().toISOString();
    profiles[activeId] = state.processedData;
    localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
  }

  // ==========================================
  // 10. ATTENDANCE LOGIC
  // ==========================================
  async function fetchAttendanceData(btn) {
    if (!state.processedData) return showToast('Fetch results first.', 'warning');
    
    const regNum = state.processedData.studentInfo.registration;
    const cacheKey = STORAGE_KEYS.ATTENDANCE_CACHE + regNum;
    
    // Check Cache
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < 600000) { // 10 mins
            return processAttendanceData(parsed.data);
        }
    }

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Fetching...';
    btn.disabled = true;

    try {
        const res = await fetch(`${ATTENDANCE_API_ENDPOINT}&registrationNumber=${encodeURIComponent(regNum)}`);
        const data = await res.json();
        
        if (!res.ok || !data.success) throw new Error(data.message);
        
        // Cache data
        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data }));
        processAttendanceData(data);
        
    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-clipboard-user me-2"></i>Attendance System';
        btn.disabled = false;
    }
  }

  function processAttendanceData(data) {
    const lmsCodes = new Set();
    Object.values(state.processedData.semesters).forEach(s => s.courses.forEach(c => lmsCodes.add(c.code.toUpperCase())));

    const courses = [];
    data.resultData.forEach(c => {
        if (!lmsCodes.has(c.CourseCode.toUpperCase())) {
            courses.push(c);
        }
    });

    if (courses.length === 0) return showToast('No new courses found in Attendance System.', 'info');

    // Populate Modal
    const list = document.getElementById('attendanceCourseList');
    list.innerHTML = '';
    courses.forEach((c, i) => {
        const div = document.createElement('div');
        div.className = 'd-flex justify-content-between border-bottom py-2';
        div.innerHTML = `
            <div class="form-check">
                <input class="form-check-input attendance-checkbox" type="checkbox" value="${i}">
                <label class="form-check-label"><strong>${c.CourseCode}</strong> (${c.CourseName}) - Marks: ${c.Totalmark}</label>
            </div>
            <select class="form-select form-select-sm w-auto ch-select" id="att-ch-${i}">
                <option value="1">1 CH</option><option value="3" selected>3 CH</option><option value="4">4 CH</option>
            </select>
        `;
        // Store raw data on element
        div.querySelector('.attendance-checkbox').dataset.raw = JSON.stringify(c);
        list.appendChild(div);
    });

    els.modals.attendance.show();
  }

  function importSelectedAttendanceCourses() {
    const checks = document.querySelectorAll('.attendance-checkbox:checked');
    let count = 0;
    
    checks.forEach(chk => {
        const raw = JSON.parse(chk.dataset.raw);
        const idx = chk.value;
        const ch = parseInt(document.getElementById(`att-ch-${idx}`).value);
        const semName = processSemesterName(raw.Semester);
        
        if (!state.processedData.semesters[semName]) {
            state.processedData.semesters[semName] = { 
                originalName: raw.Semester, 
                sortKey: getSemesterSortKey(semName), 
                courses: [] 
            };
        }

        state.processedData.semesters[semName].courses.push({
            code: raw.CourseCode,
            title: raw.CourseName,
            creditHours: ch,
            marks: parseFloat(raw.Totalmark),
            grade: raw.Grade,
            qualityPoints: calculateQualityPoints(parseFloat(raw.Totalmark), ch, raw.Grade),
            isCustom: true,
            source: 'attendance',
            isDeleted: false
        });
        count++;
    });

    if (count > 0) {
        showToast(`Imported ${count} courses.`, 'success');
        renderResults(state.processedData);
        saveCurrentProfile();
        els.modals.attendance.hide();
    }
  }

  // ==========================================
  // 11. PDF GENERATION
  // ==========================================
  function generatePDF() {
    if (!state.processedData) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(122, 106, 216); // Brand Color
    doc.text("UAF CGPA Calculator - Report", 105, 20, null, null, 'center');
    
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Name: ${state.processedData.studentInfo.name}`, 14, 40);
    doc.text(`Registration: ${state.processedData.studentInfo.registration}`, 14, 48);
    
    // Filter data based on view
    let dataToPrint = state.processedData;
    if (state.bedModeActive) {
        const activeTab = document.querySelector('#bedTab .nav-link.active').id;
        const isBed = activeTab === 'bed-tab';
        const filteredSems = filterSemesters(state.processedData.semesters, isBed);
        dataToPrint = { ...state.processedData, semesters: filteredSems };
    }
    
    const stats = calculateCGPA(dataToPrint);
    doc.text(`CGPA: ${stats.cgpa.toFixed(4)}`, 150, 40);
    doc.text(`Percentage: ${stats.percentage.toFixed(2)}%`, 150, 48);

    let finalY = 60;

    Object.keys(dataToPrint.semesters).sort((a,b) => dataToPrint.semesters[a].sortKey.localeCompare(dataToPrint.semesters[b].sortKey)).forEach(sem => {
        const sData = dataToPrint.semesters[sem];
        if(sData.courses.length === 0) return;

        if (finalY > 270) { doc.addPage(); finalY = 20; }
        
        doc.setFontSize(14);
        doc.setTextColor(122, 106, 216);
        doc.text(`${sem} (GPA: ${sData.gpa.toFixed(4)})`, 14, finalY);
        finalY += 5;

        const body = sData.courses.filter(c => !c.isDeleted).map(c => [
            c.code, c.title, c.creditHours, c.marks, c.grade
        ]);

        doc.autoTable({
            startY: finalY,
            head: [['Code', 'Title', 'CH', 'Marks', 'Grade']],
            body: body,
            theme: 'grid',
            headStyles: { fillColor: [122, 106, 216] },
            margin: { left: 14, right: 14 }
        });
        
        finalY = doc.lastAutoTable.finalY + 15;
    });

    doc.save(`UAF_Result_${state.processedData.studentInfo.registration}.pdf`);
  }

  // ==========================================
  // 12. UTILITY FUNCTIONS
  // ==========================================
  function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<div class="toast-content"><i class="fa-solid fa-info-circle me-2"></i><span>${msg}</span></div>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
  }

  function createToastContainer() {
    const d = document.createElement('div');
    d.id = 'toast-container';
    document.body.appendChild(d);
    return d;
  }

  function showLoadingStage(stage) {
    if (!els.loadingContainer) return;
    els.loadingContainer.style.display = stage ? 'block' : 'none';
    ['connecting','fetching','processing','complete'].forEach(s => {
        const el = document.getElementById(`${s}Stage`);
        if(el) el.style.display = (s === stage) ? 'block' : 'none';
    });
  }

  function processSemesterName(raw) {
      if(raw.toLowerCase().includes('winter')) return `Winter ${raw.match(/\d{4}/)?.[0] || ''}`;
      if(raw.toLowerCase().includes('spring')) return `Spring ${raw.match(/\d{4}/)?.[0] || ''}`;
      if(raw.toLowerCase().includes('summer')) return `Summer ${raw.match(/\d{4}/)?.[0] || ''}`;
      return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
  
  function getSemesterSortKey(name) {
      const year = parseInt(name.match(/\d{4}/)?.[0] || 9999);
      if(name.toLowerCase().includes('winter')) return `${year}-1`;
      if(name.toLowerCase().includes('spring')) return `${year-1}-2`; // Spring 2021 follows Winter 2020
      if(name.toLowerCase().includes('summer')) return `${year-1}-3`;
      return `${year}-9`;
  }

  function filterSemesters(semesters, isBed) {
      const filtered = {};
      Object.keys(semesters).forEach(k => {
          const hasBedC = semesters[k].courses.some(c => BED_COURSES.has(c.code));
          if((isBed && hasBedC) || (!isBed && !hasBedC)) filtered[k] = semesters[k];
      });
      return filtered;
  }

  function setupAttendanceButton(btn) {
      if(!btn) return;
      // Remove old listeners to avoid duplicates by replacing the node
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', () => fetchAttendanceData(newBtn));
  }
  
  function updateAttendanceButtonForTab(prefix) {
      const btn = document.getElementById(`${prefix}-fetchAttendanceBtn`);
      setupAttendanceButton(btn);
  }

  function renderGpaChart(data, canvasId = 'gpaTrendChart') {
      const canvas = document.getElementById(canvasId);
      if(!canvas) return;
      if(state[canvasId]) state[canvasId].destroy();

      const labels = [];
      const values = [];
      
      Object.keys(data.semesters).sort((a,b) => data.semesters[a].sortKey.localeCompare(data.semesters[b].sortKey)).forEach(sem => {
          if(data.semesters[sem].courses.length > 0) {
              labels.push(sem);
              values.push(data.semesters[sem].gpa);
          }
      });

      state[canvasId] = new Chart(canvas, {
          type: 'line',
          data: {
              labels: labels,
              datasets: [{
                  label: 'GPA',
                  data: values,
                  borderColor: '#7a6ad8',
                  backgroundColor: 'rgba(122, 106, 216, 0.2)',
                  tension: 0.3,
                  fill: true
              }]
          },
          options: {
              responsive: true,
              scales: { y: { beginAtZero: true, max: 4 } }
          }
      });
      // Show container
      const containerId = canvasId === 'gpaTrendChart' ? 'gpaChartContainer' : `${canvasId.replace('TrendChart','ChartContainer')}`;
      const container = document.getElementById(containerId);
      if(container) container.style.display = 'block';
  }

  function toggleCourseStatus(semName, courseIndex, isDelete) {
      state.processedData.semesters[semName].courses[courseIndex].isDeleted = isDelete;
      saveCurrentProfile();
      renderResults(state.processedData);
  }

  function deleteSemester(name) {
      state.deletedSemesters[name] = state.processedData.semesters[name];
      delete state.processedData.semesters[name];
      saveCurrentProfile();
      renderResults(state.processedData);
      showToast('Semester deleted. Reload profile to undo if needed.', 'warning');
  }

  function openAddCourseModal(semester) {
      document.getElementById('addCourseSemester').value = semester;
      els.modals.addCourse.show();
  }

  function openRenameSemesterModal(name) {
      document.getElementById('newSemesterName').value = name;
      const saveBtn = document.getElementById('saveSemesterNameBtn');
      // Remove previous listener to prevent stacking
      const newSaveBtn = saveBtn.cloneNode(true);
      saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
      
      newSaveBtn.onclick = () => {
          const newName = document.getElementById('newSemesterName').value;
          if(!newName) return;
          state.processedData.semesters[newName] = state.processedData.semesters[name];
          state.processedData.semesters[newName].originalName = newName;
          delete state.processedData.semesters[name];
          saveCurrentProfile();
          renderResults(state.processedData);
          els.modals.renameSem.hide();
      };
      els.modals.renameSem.show();
  }

  function showCourseDetails(c) {
      const body = document.getElementById('courseDetailsModalBody');
      body.innerHTML = `
        <p><strong>Teacher:</strong> ${c.teacher}</p>
        <p><strong>Marks:</strong> Mid (${c.mid || 'N/A'}), Assign (${c.assignment || 'N/A'}), Final (${c.final || 'N/A'}), Prac (${c.practical || 'N/A'})</p>
        <p><strong>Quality Points:</strong> ${c.qualityPoints}</p>
      `;
      els.modals.course.show();
  }

  function migrateOldProfiles() {
      // Basic migration logic if old format exists
      const old = localStorage.getItem('uafCalculatorProfiles');
      if(old) {
          localStorage.setItem(STORAGE_KEYS.PROFILES, old);
          localStorage.removeItem('uafCalculatorProfiles');
      }
  }

  function initScrollAnimations() {
      const obs = new IntersectionObserver(ents => ents.forEach(e => {
          if(e.isIntersecting) e.target.classList.add('is-visible');
      }));
      document.querySelectorAll('.fade-in-on-scroll').forEach(el => obs.observe(el));
  }

  function initCustomCursor() {
      document.addEventListener('mousemove', e => {
          if(window.innerWidth > 992) {
              els.cursorDot.style.display = 'block';
              els.cursorDot.style.left = e.clientX + 'px';
              els.cursorDot.style.top = e.clientY + 'px';
          }
      });
  }

  function initBackToTop() {
      window.onscroll = () => els.backToTop.classList.toggle('visible', window.scrollY > 300);
      els.backToTop.onclick = () => window.scrollTo({top:0, behavior:'smooth'});
  }

  function checkServerStatuses() {
      // Basic implementation: In a real scenario, this would ping the endpoints.
      // Here we assume 'online' unless fetch fails later.
      document.getElementById('lms-status-item').classList.add('status-loaded');
      document.getElementById('lms-status-dot').className = 'status-dot online';
      document.getElementById('attnd-status-item').classList.add('status-loaded');
      document.getElementById('attnd-status-dot').className = 'status-dot online';
  }
  
  function addStatusMessage(msg, type='info') {
      const log = document.getElementById('statusLog');
      if(!log) return;
      const line = document.createElement('div');
      line.className = `status-line status-${type}`;
      line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
      log.prepend(line);
  }

  function setupEventListeners() {
      els.form.addEventListener('submit', (e) => { e.preventDefault(); fetchResult(); });
      document.getElementById('submitPassKeyBtn').addEventListener('click', RestrictedAccess.validate);
      els.profileSwitcher.addEventListener('change', (e) => {
          localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, e.target.value);
          loadProfiles();
      });
      document.getElementById('importAttendanceCoursesBtn').addEventListener('click', importSelectedAttendanceCourses);
      els.downloadPdfBtn.addEventListener('click', generatePDF);
      document.getElementById('bed-downloadPdfBtn')?.addEventListener('click', generatePDF);
      document.getElementById('other-downloadPdfBtn')?.addEventListener('click', generatePDF);
      
      // Add custom course save
      document.getElementById('saveCourseBtn').addEventListener('click', () => {
          const sem = document.getElementById('addCourseSemester').value;
          const code = document.getElementById('courseCode').value;
          const title = document.getElementById('courseTitle').value;
          const ch = parseInt(document.getElementById('creditHours').value);
          const marks = parseFloat(document.getElementById('courseMarks').value);
          
          if(state.processedData.semesters[sem]) {
              state.processedData.semesters[sem].courses.push({
                  code, title, creditHours: ch, marks, grade: 'N/A', 
                  qualityPoints: calculateQualityPoints(marks, ch, 'N/A'),
                  isCustom: true, isDeleted: false
              });
              saveCurrentProfile();
              renderResults(state.processedData);
              els.modals.addCourse.hide();
          }
      });

      // Save collapsed state on toggle
      ['gpaChartCollapse', 'statusLogCollapse'].forEach(id => {
          const el = document.getElementById(id);
          if (el) {
              el.addEventListener('hidden.bs.collapse', () => saveUiState(id === 'gpaChartCollapse' ? 'gpaChartCollapsed' : 'statusLogCollapsed', true));
              el.addEventListener('shown.bs.collapse', () => saveUiState(id === 'gpaChartCollapse' ? 'gpaChartCollapsed' : 'statusLogCollapsed', false));
          }
      });
      
      // Save Tab State
      const tabEls = document.querySelectorAll('button[data-bs-toggle="tab"]');
      tabEls.forEach(tab => {
          tab.addEventListener('shown.bs.tab', (event) => {
              saveUiState('activeBedTab', event.target.id); // e.g. "bed-tab"
          });
      });
      
      // Profile Manager Button Listeners
      document.getElementById('openProfileManagerBtn')?.addEventListener('click', () => {
          renderProfileManagerList();
          els.modals.manager.show();
      });
      
      // Add Forecast Button Logic
      els.addForecastBtn.addEventListener('click', () => {
          if(!state.processedData) return;
          let i = 1;
          while(state.processedData.semesters[`Forecast ${i}`]) i++;
          const name = `Forecast ${i}`;
          state.processedData.semesters[name] = { originalName: name, sortKey: `3000-${i}`, courses: [] };
          saveCurrentProfile();
          renderResults(state.processedData);
      });
  }
  
  function renderProfileManagerList() {
      const list = document.getElementById('profileManagerList');
      const profiles = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFILES) || '{}');
      list.innerHTML = '';
      Object.keys(profiles).forEach(id => {
          const p = profiles[id];
          const li = document.createElement('li');
          li.className = 'profile-item';
          li.innerHTML = `
            <div class="profile-item-details">
                <div class="profile-item-name">${p.displayName}</div>
                <div class="profile-item-meta">${p.studentInfo.registration} - ${new Date(p.lastModified).toLocaleDateString()}</div>
            </div>
            <button class="btn btn-sm btn-danger-action" onclick="deleteProfile('${id}')">Delete</button>
          `;
          list.appendChild(li);
      });
      document.getElementById('profileCountStat').textContent = `${Object.keys(profiles).length} Profiles`;
  }
  
  // Expose global delete for the inline onclick in Profile Manager
  window.deleteProfile = function(id) {
      const profiles = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFILES) || '{}');
      delete profiles[id];
      localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
      renderProfileManagerList();
      loadProfiles(); // Refresh main switcher
  };

  // Start App
  init();
});
