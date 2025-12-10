document.addEventListener('DOMContentLoaded', function() {
  // --- DOM Elements ---
  const resultForm = document.getElementById('resultForm');
  const registrationNumber = document.getElementById('registrationNumber');
  const resultContainer = document.getElementById('resultContainer');
  const statusLog = document.getElementById('statusLog');
  const themeToggle = document.getElementById('themeToggle');
  const cursorDot = document.getElementById('cursorDot');
  const contactForm = document.getElementById('contact-form');
  const downloadLogBtn = document.getElementById('downloadLogBtn');
  const clearLogBtn = document.getElementById('clearLogBtn');
  const semesterResults = document.getElementById('semesterResults');
  
  // Header Elements
  const studentName = document.getElementById('studentName');
  const studentReg = document.getElementById('studentReg');
  const totalCgpa = document.getElementById('totalCgpa');
  const totalPercentage = document.getElementById('totalPercentage');
  const totalMarksObtained = document.getElementById('totalMarksObtained');
  const totalMaxMarks = document.getElementById('totalMaxMarks');
  
  // Buttons
  const downloadPdfBtn = document.getElementById('downloadPdfBtn');
  const saveCourseBtn = document.getElementById('saveCourseBtn');
  const addForecastSemesterBtn = document.getElementById('addForecastSemesterBtn');
  const backToTopButton = document.getElementById('backToTop');
  
  // Modals
  const courseDetailsModal = new bootstrap.Modal(document.getElementById('courseDetailsModal'));
  const addCourseModal = new bootstrap.Modal(document.getElementById('addCourseModal'));
  const addCourseForm = document.getElementById('addCourseForm');
  const loadingContainer = document.getElementById('loadingContainer');
  
  // Charts
  const gpaChartContainer = document.getElementById('gpaChartContainer');
  const gpaTrendChartCanvas = document.getElementById('gpaTrendChart').getContext('2d');
  
  // Profile Management UI
  const profileSwitcher = document.getElementById('profileSwitcher');
  const renameProfileModal = new bootstrap.Modal(document.getElementById('renameProfileModal'));
  const saveProfileNameBtn = document.getElementById('saveProfileNameBtn');
  const openProfileManagerBtn = document.getElementById('openProfileManagerBtn');
  const profileManagerModal = new bootstrap.Modal(document.getElementById('profileManagerModal'));
  const profileManagerModalEl = document.getElementById('profileManagerModal');
  const renameProfileModalEl = document.getElementById('renameProfileModal');
  const confirmationModal = new bootstrap.Modal(document.getElementById('confirmationModal'));
  const confirmationModalEl = document.getElementById('confirmationModal');
  
  // Import/Export
  const importProfilesBtn = document.getElementById('importProfilesBtn');
  const exportProfilesBtn = document.getElementById('exportProfilesBtn');
  const importProfilesBtnModal = document.getElementById('importProfilesBtnModal');
  const exportProfilesBtnModal = document.getElementById('exportProfilesBtnModal');

  // Attendance Elements (initialized in setupAttendanceButton)
  let fetchAttendanceBtn = document.getElementById('fetchAttendanceBtn');
  let bedFetchAttendanceBtn = document.getElementById('bed-fetchAttendanceBtn');
  let otherFetchAttendanceBtn = document.getElementById('other-fetchAttendanceBtn');
  const attendanceImportModal = new bootstrap.Modal(document.getElementById('attendanceImportModal'));
  const attendanceImportModalEl = document.getElementById('attendanceImportModal');
  const importAttendanceCoursesBtn = document.getElementById('importAttendanceCoursesBtn');

  // --- State Variables ---
  let renameSemesterModal; 
  let saveSemesterNameBtn; 
  let bedConfirmationModal;
  
  let allLogs = [];
  let processedData = null;
  let deletedSemesters = {};
  let gpaChart = null;
  let bedGpaChart = null;
  let otherGpaChart = null;
  let isInitialLoad = true;
  let confirmationCallback = null;
  let importedAttendanceCourses = []; 
  let bedModeActive = false;

  // --- Constants ---
  const BED_COURSES = new Set([
    'EDU-501', 'EDU-503', 'EDU-505', 'EDU-507', 'EDU-509', 'EDU-511', 'EDU-513',
    'EDU-502', 'EDU-504', 'EDU-506', 'EDU-508', 'EDU-510', 'EDU-512', 'EDU-516',
    'EDU-601', 'EDU-604', 'EDU-605', 'EDU-607', 'EDU-608', 'EDU-623'
  ]);
  const API_ENDPOINT = `/api/result-scraper?action=scrape_single`;
  const ATTENDANCE_API_ENDPOINT = `/api/result-scraper?action=scrape_attendance`;

  // --- Initialization ---
  function init() {
    try {
      migrateOldProfiles(); 
      initCustomCursor();
      initTheme();
      
      renameSemesterModal = new bootstrap.Modal(document.getElementById('renameSemesterModal'));
      saveSemesterNameBtn = document.getElementById('saveSemesterNameBtn');
      saveSemesterNameBtn.addEventListener('click', renameSemester); 
      
      initContactForm();
      createToastContainer();
      initBackToTop();
      initScrollAnimations();
      loadProfiles(); 
      initModalZIndexHandlers(); 
      initMenuAutoCollapse();

      // --- FIX: Initialize Attendance Buttons Here ---
      setupAttendanceButton(); 
      // -----------------------------------------------

      const bedModalEl = document.getElementById('bedConfirmationModal');
      if (bedModalEl) {
          bedConfirmationModal = new bootstrap.Modal(bedModalEl);
      }
    } catch (error) { 
        console.error("Initialization failed:", error);
        createToastContainer(); 
        showToast("Error initializing application. Saved data might be corrupted.", "error");
    }
  }

  function initMenuAutoCollapse() {
    const navLinks = document.querySelectorAll('#mainNav .nav-link');
    const togglerButton = document.querySelector('.navbar-toggler[data-bs-target="#mainNav"]');
    const collapsibleMenu = document.getElementById('mainNav');

    if (!togglerButton || !collapsibleMenu) return;

    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (collapsibleMenu.classList.contains('show')) {
          togglerButton.click();
        }
      });
    });
  }

  function initTheme() {
    const THEME_KEY = 'uaf-theme';
    const themeToggleInput = document.getElementById('themeToggleInput');
    const themeToggleBtn = document.getElementById('themeToggleBtn');

    const applyTheme = (theme) => {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem(THEME_KEY, theme);
      const isDark = theme === 'dark';
      
      if (themeToggleInput) themeToggleInput.checked = isDark;
      if (themeToggleBtn) {
          const iconClass = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
          themeToggleBtn.innerHTML = `<i class="${iconClass}"></i>`;
      }
    };

    const currentTheme = localStorage.getItem(THEME_KEY) || 'light';
    applyTheme(currentTheme);

    const toggleLogic = () => {
      const newTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      applyTheme(newTheme);
    };

    if (themeToggleInput) themeToggleInput.addEventListener('change', toggleLogic);
    if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleLogic);
  }

  // --- Profile Management Logic ---

  function getProfiles() {
    return JSON.parse(localStorage.getItem('uafCalculatorProfiles_v2') || '{}');
  }

  function saveProfiles(profiles) {
    localStorage.setItem('uafCalculatorProfiles_v2', JSON.stringify(profiles));
  }

  function getActiveProfileId() {
    return localStorage.getItem('uafCalculatorActiveProfile_v2');
  }

  function setActiveProfileId(id) {
    localStorage.setItem('uafCalculatorActiveProfile_v2', id);
  }

  function getBackupInfo() {
      return JSON.parse(localStorage.getItem('uafCalculatorBackupInfo') || '{}');
  }

  function saveBackupInfo(info) {
      localStorage.setItem('uafCalculatorBackupInfo', JSON.stringify(info));
  }

  function migrateOldProfiles() {
      const oldProfilesData = localStorage.getItem('uafCalculatorProfiles');
      if (oldProfilesData) {
          try {
              const oldProfiles = JSON.parse(oldProfilesData);
              const newProfiles = getProfiles();
              let migratedCount = 0;

              Object.keys(oldProfiles).forEach(oldId => {
                  const oldProfile = oldProfiles[oldId];
                  const alreadyExists = Object.values(newProfiles).some(
                      p => p.studentInfo.registration === oldProfile.studentInfo.registration
                  );

                  if (!alreadyExists && oldProfile.studentInfo) {
                      const newProfile = {
                          ...oldProfile,
                          displayName: `${oldProfile.studentInfo.name} (${oldProfile.studentInfo.registration})`,
                          createdAt: new Date().toISOString(),
                          lastModified: new Date().toISOString()
                      };
                      const newId = `profile_${Date.now()}_${migratedCount}`;
                      newProfiles[newId] = newProfile;
                      migratedCount++;
                  }
              });

              if (migratedCount > 0) {
                  saveProfiles(newProfiles);
                  showToast(`${migratedCount} profile(s) migrated!`, 'success');
              }
              localStorage.removeItem('uafCalculatorProfiles');
          } catch (e) {
              console.error("Failed to migrate old profiles:", e);
          }
      }
  }

  function loadProfiles() {
    try {
      const profiles = getProfiles();
      const activeProfileId = getActiveProfileId();
      updateProfileSwitcher(profiles, activeProfileId);

      if (activeProfileId && profiles[activeProfileId]) {
        loadProfile(activeProfileId);
        addStatusMessage('Loaded active profile from session.', 'info');
      } else if (activeProfileId) {
        setActiveProfileId('');
        addStatusMessage('Cleared invalid active profile ID.', 'warning');
      }
    } catch (error) {
      console.error("Failed to load profiles:", error);
      showToast("Error loading saved profiles.", "error");
      localStorage.removeItem('uafCalculatorProfiles_v2');
      localStorage.removeItem('uafCalculatorActiveProfile_v2');
      updateProfileSwitcher({}, '');
    }
  }

  function updateProfileSwitcher(profiles, activeProfileId) {
    const profileKeys = Object.keys(profiles);
    const activeProfileUI = document.getElementById('activeProfileUI');
    const initialProfileUI = document.getElementById('initialProfileUI');
    
    if (profileKeys.length > 0) {
      profileSwitcher.innerHTML = '<option value="">Select a saved profile...</option>';
      profileKeys.forEach(profileId => {
        const profile = profiles[profileId];
        if (profile && profile.studentInfo) {
            const option = document.createElement('option');
            option.value = profileId;
            option.textContent = profile.displayName || `${profile.studentInfo.name} (${profile.studentInfo.registration})`;
            if (profileId === activeProfileId) option.selected = true;
            profileSwitcher.appendChild(option);
        }
      });
      if(activeProfileUI) activeProfileUI.style.display = 'block';
      if(initialProfileUI) initialProfileUI.style.display = 'none';
    } else {
        profileSwitcher.innerHTML = '<option value="">No profiles found</option>';
        if(activeProfileUI) activeProfileUI.style.display = 'none';
        if(initialProfileUI) initialProfileUI.style.display = 'block';
    }
  }

  function loadProfile(profileId) {
    const profiles = getProfiles();
    if (profiles[profileId]) {
      processedData = profiles[profileId];
      isInitialLoad = true;
      bedModeActive = processedData.bedMode || false;
      renderResults(processedData);
      registrationNumber.value = processedData.studentInfo.registration;
      setActiveProfileId(profileId);
      updateProfileSwitcher(profiles, profileId);
    }
  }

  function saveActiveProfile() {
    const activeProfileId = getActiveProfileId();
    if (activeProfileId && processedData) {
        const profiles = getProfiles();
        if (profiles[activeProfileId]) {
            processedData.lastModified = new Date().toISOString();
            profiles[activeProfileId] = processedData;
            saveProfiles(profiles);
        }
    }
  }

  function renderProfileManager() {
    const profiles = getProfiles();
    const profileListEl = document.getElementById('profileManagerList');
    const profileCountStat = document.getElementById('profileCountStat');
    const lastBackupStat = document.getElementById('lastBackupStat');
    const profileKeys = Object.keys(profiles);

    profileCountStat.textContent = `${profileKeys.length} Profile${profileKeys.length !== 1 ? 's' : ''}`;
    const backupInfo = getBackupInfo();
    lastBackupStat.textContent = backupInfo.lastBackup ? `Last Backup: ${new Date(backupInfo.lastBackup).toLocaleString()}` : 'Last Backup: Never';

    if (profileKeys.length === 0) {
        profileListEl.innerHTML = '<li class="text-center text-muted p-4">No profiles saved yet.</li>';
        document.getElementById('bulkActionsBtn').disabled = true;
        document.getElementById('exportProfilesBtnModal').disabled = true;
        return;
    }

    profileListEl.innerHTML = profileKeys.map(id => {
        const profile = profiles[id];
        const lastModified = profile.lastModified ? new Date(profile.lastModified).toLocaleString() : 'N/A';
        let detailsHtml = '';

        if (profile.bedMode) {
            const bedSemesters = filterSemesters(profile.semesters, true);
            const bedData = { ...profile, semesters: bedSemesters };
            const bedCgpa = calculateCGPA(bedData);
            const bedSemCount = Object.keys(bedData.semesters).length;

            const otherSemesters = filterSemesters(profile.semesters, false);
            const otherData = { ...profile, semesters: otherSemesters };
            const otherCgpa = calculateCGPA(otherData);
            const otherSemCount = Object.keys(otherData.semesters).length;

            detailsHtml = `
              <div class="profile-item-name">${profile.displayName} <span class="badge bg-primary-subtle text-primary-emphasis rounded-pill ms-2">B.Ed.</span></div>
              <div class="profile-item-meta" style="grid-column: 1 / -1;"><i class="fa-solid fa-id-card"></i> ${profile.studentInfo.registration}</div>
              <div class="profile-item-meta text-primary"><i class="fa-solid fa-graduation-cap"></i> B.Ed: ${bedCgpa.cgpa.toFixed(2)} (${bedSemCount} Sem)</div>
              <div class="profile-item-meta text-primary"><i class="fa-solid fa-graduation-cap"></i> Oth: ${otherCgpa.cgpa.toFixed(2)} (${otherSemCount} Sem)</div>
              <div class="profile-item-meta" style="grid-column: 1 / -1;"><i class="fa-solid fa-clock"></i> ${lastModified}</div>
            `;
        } else {
            const cgpaData = calculateCGPA(profile);
            const semCount = Object.keys(profile.semesters).length;
            detailsHtml = `
              <div class="profile-item-name">${profile.displayName}</div>
              <div class="profile-item-meta"><i class="fa-solid fa-id-card"></i> ${profile.studentInfo.registration}</div>
              <div class="profile-item-meta"><i class="fa-solid fa-graduation-cap"></i> CGPA: ${cgpaData.cgpa.toFixed(4)}</div>
              <div class="profile-item-meta"><i class="fa-solid fa-book"></i> ${semCount} Semesters</div>
              <div class="profile-item-meta"><i class="fa-solid fa-clock"></i> ${lastModified}</div>
            `;
        }

        return `
          <li class="profile-item" data-profile-id="${id}">
              <input class="form-check-input profile-checkbox" type="checkbox" value="${id}">
              <div class="profile-item-details" style="${profile.bedMode ? 'grid-template-columns: repeat(2, 1fr);' : ''}">
                  ${detailsHtml}
              </div>
              <div class="profile-item-actions">
                  <button class="btn btn-sm btn-soft rounded-pill action-load" title="Load"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>
                  <button class="btn btn-sm btn-soft rounded-pill action-rename" title="Rename"><i class="fa-solid fa-pen"></i></button>
                  <button class="btn btn-sm btn-soft rounded-pill text-danger action-delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
              </div>
          </li>
        `;
    }).join('');

    attachProfileManagerListeners(profiles);
  }

  function attachProfileManagerListeners(profiles) {
    const list = document.getElementById('profileManagerList');
    list.querySelectorAll('.action-load').forEach(btn => btn.addEventListener('click', e => {
        loadProfile(e.currentTarget.closest('.profile-item').dataset.profileId);
        profileManagerModal.hide();
    }));
    list.querySelectorAll('.action-rename').forEach(btn => btn.addEventListener('click', e => {
        openRenameModal(e.currentTarget.closest('.profile-item').dataset.profileId);
    }));
    list.querySelectorAll('.action-delete').forEach(btn => btn.addEventListener('click', e => {
        const id = e.currentTarget.closest('.profile-item').dataset.profileId;
        showConfirmationModal('Delete Profile?', `Delete "${profiles[id]?.displayName}"?`, () => deleteProfiles([id]));
    }));
  }


// --- Bulk Actions & Export/Import ---

  function handleBulkAction() {
      const selectedIds = Array.from(document.querySelectorAll('.profile-checkbox:checked')).map(cb => cb.value);
      if (selectedIds.length === 0) {
          showToast('No profiles selected.', 'warning');
          return;
      }
      showConfirmationModal(`Delete ${selectedIds.length} Profiles?`, `This will permanently delete the selected profiles.`, () => {
          deleteProfiles(selectedIds);
      });
  }

  function deleteProfiles(idsToDelete) {
      const profiles = getProfiles();
      let deletedCount = 0;
      idsToDelete.forEach(id => {
          if (profiles[id]) {
              delete profiles[id];
              deletedCount++;
              if (getActiveProfileId() === id) {
                  setActiveProfileId('');
              }
          }
      });
      saveProfiles(profiles);
      showToast(`Successfully deleted ${deletedCount} profile(s).`, 'success');
      renderProfileManager();
      updateProfileSwitcher(profiles, getActiveProfileId());
      if (!getActiveProfileId()) {
          resultContainer.style.display = 'none';
          document.getElementById('bedResultContainer').style.display = 'none'; 
          registrationNumber.value = '';
      }
  }

  function exportSelectedProfiles() {
      const selectedIds = Array.from(document.querySelectorAll('#profileManagerList .profile-checkbox:checked')).map(cb => cb.value);
      const profiles = getProfiles();
      const profilesToExport = {};
      let exportCount = 0;
      let filename = `uaf-cgpa-profiles-backup-${new Date().toISOString().split('T')[0]}.json`;

      if (selectedIds.length === 0) {
          showToast('No profiles selected to export.', 'warning');
          return;
      }

      selectedIds.forEach(id => {
          if (profiles[id]) {
              profilesToExport[id] = profiles[id];
              exportCount++;
          }
      });

      if (exportCount === 1) {
          const singleProfileId = selectedIds[0];
          let profileName = 'profile'; 
          if (profiles[singleProfileId].displayName) {
              profileName = profiles[singleProfileId].displayName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
          } else if (profiles[singleProfileId].studentInfo && profiles[singleProfileId].studentInfo.registration) {
              profileName = profiles[singleProfileId].studentInfo.registration.replace(/[^a-z0-9]/gi, '_').toLowerCase();
          }
          filename = `${profileName}-profile-backup.json`;
      }

      const backupData = {
          version: '2.0.0',
          exportDate: new Date().toISOString(),
          profiles: profilesToExport
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = function() {
          const base64data = reader.result;
          forceAndroidDownload(filename, base64data);
          saveBackupInfo({ lastBackup: new Date().toISOString() });
          showToast(`${exportCount} profile(s) exported.`, 'success');
          renderProfileManager();
      };
  }

  function importProfiles() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = e => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = event => {
              try {
                  const importedData = JSON.parse(event.target.result);
                  if (!importedData.profiles || importedData.version !== '2.0.0') {
                      throw new Error('Invalid or incompatible backup file.');
                  }
                  const existingProfiles = getProfiles();
                  let importedCount = 0, skippedCount = 0;

                  Object.keys(importedData.profiles).forEach(id => {
                      if (existingProfiles[id]) {
                          skippedCount++;
                      } else {
                          existingProfiles[id] = importedData.profiles[id];
                          importedCount++;
                      }
                  });

                  saveProfiles(existingProfiles);
                  showToast(`Import complete: ${importedCount} added, ${skippedCount} skipped.`, 'success');
                  loadProfiles(); 
                  if (profileManagerModalEl.classList.contains('show')) {
                    renderProfileManager(); 
                  }
              } catch (error) {
                  showToast(`Import failed: ${error.message}`, 'error');
              }
          };
          reader.onerror = event => {
              showToast('Failed to read the file.', 'error');
          };
          reader.readAsText(file);
      };
      input.click();
  }

  function forceAndroidDownload(filename, dataUri) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/api/download'; 
    form.style.display = 'none';

    const nameInput = document.createElement('input');
    nameInput.name = 'filename';
    nameInput.value = filename;
    form.appendChild(nameInput);

    const dataInput = document.createElement('input');
    dataInput.name = 'fileData';
    dataInput.value = dataUri;
    form.appendChild(dataInput);

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }

  // --- Utilities & Logging ---

  function addStatusMessage(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    allLogs.push({ timestamp, message, type });
    const messageEl = document.createElement('div');
    messageEl.className = `status-line status-${type}`;
    messageEl.textContent = `[${timestamp}] ${message}`;
    statusLog.prepend(messageEl);
    statusLog.scrollTop = 0;
  }

  function showLoadingStage(stage) {
    ['connecting', 'fetching', 'processing', 'complete'].forEach(s => {
      const el = document.getElementById(`${s}Stage`);
      if (el) el.style.display = 'none';
    });
    if (stage) {
        const el = document.getElementById(`${stage}Stage`);
        if (el) el.style.display = 'block';
    }
    loadingContainer.style.display = stage ? 'block' : 'none';
  }

  function downloadLog() {
    let logContent = "UAF CGPA Calculator - M SAQLAIN - Activity Log\n============================================\n\n";
    allLogs.forEach(log => logContent += `[${log.timestamp}] ${log.message}\n`);
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cgpa_calculator_log_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Log file downloaded!', 'success');
  }

  function clearLog() {
    statusLog.innerHTML = '';
    allLogs = [];
    showToast('Log cleared', 'info');
  }

  // --- Calculation Logic ---

  function processSemesterName(semester) {
      if (!semester) return 'Unknown Semester';
      const semesterLower = semester.toLowerCase();
      const yearRangeMatch = semesterLower.match(/(\d{4})-(\d{2,4})/);
      const singleYearMatch = semesterLower.match(/\b(\d{4})\b/);

      let season = 'Unknown';
      let year = '';

      if (semesterLower.includes('spring')) {
          season = 'Spring';
          if (yearRangeMatch) {
              year = yearRangeMatch[2]; 
              if (year.length === 2) year = `20${year}`;
          } else if (singleYearMatch) {
              year = (parseInt(singleYearMatch[1]) + 1).toString();
          }
      } else if (semesterLower.includes('winter')) {
          season = 'Winter';
          if (yearRangeMatch) year = yearRangeMatch[1];
          else if (singleYearMatch) year = singleYearMatch[1];
      } else if (semesterLower.includes('summer')) {
          season = 'Summer';
          if (yearRangeMatch) year = yearRangeMatch[1];
          else if (singleYearMatch) year = singleYearMatch[1];
      } else if (semesterLower.includes('fall')) {
          season = 'Fall';
          if (yearRangeMatch) year = yearRangeMatch[1];
          else if (singleYearMatch) year = singleYearMatch[1];
      }

      if (season !== 'Unknown' && year) return `${season} ${year}`;

      const attendanceMatch = semesterLower.match(/^(winter|spring|summer|fall)(\d{2})$/);
      if (attendanceMatch) {
          const season = attendanceMatch[1].charAt(0).toUpperCase() + attendanceMatch[1].slice(1);
          const yearYY = attendanceMatch[2];
          return `${season} 20${yearYY}`; 
      }

      return semester.charAt(0).toUpperCase() + semester.slice(1);
  }

  function getSemesterOrderKey(processedSemesterName) {
    if (!processedSemesterName) return '9999-9';
    const semesterLower = processedSemesterName.toLowerCase();

    if (semesterLower.startsWith('forecast')) {
        const num = parseInt(semesterLower.split(' ')[1] || '1');
        return `3000-${num.toString().padStart(2, '0')}`;
    }

    let year = 0;
    let seasonOrder = 9;
    const yearMatch = semesterLower.match(/\b(\d{4})\b/); 
    if (yearMatch) year = parseInt(yearMatch[1]);
    else return '9999-9'; 

    let academicYearStart = year;

    if (semesterLower.includes('winter')) {
        seasonOrder = 1;
        academicYearStart = year; 
    } else if (semesterLower.includes('spring')) {
        seasonOrder = 2;
        academicYearStart = year - 1; 
    } else if (semesterLower.includes('summer')) {
        seasonOrder = 3;
        academicYearStart = year - 1; 
    } else if (semesterLower.includes('fall')) {
        seasonOrder = 4;
        academicYearStart = year;
    } else {
         seasonOrder = 9; 
         academicYearStart = year;
    }
    return `${academicYearStart}-${seasonOrder}`;
  }

  function processScrapedData(data) {
    if (!data || !data.resultData) return null;
    const studentInfo = { name: data.resultData[0]?.StudentName || '', registration: data.resultData[0]?.RegistrationNo || '' };
    const semesters = {};
    const courseHistory = {};
    let hasBedCourses = false; 

    data.resultData.forEach(course => {
      const originalSemester = course.Semester || 'Unknown Semester';
      const semesterName = processSemesterName(originalSemester);
      const courseCode = (course.CourseCode || '').trim().toUpperCase();
      const historyKey = courseCode;

      const isBedCourse = BED_COURSES.has(courseCode); 
      if (isBedCourse) hasBedCourses = true;

      if (!semesters[semesterName]) {
        semesters[semesterName] = { 
          originalName: originalSemester, 
          sortKey: getSemesterOrderKey(semesterName), 
          courses: [],
          hasBedCourses: false,    
          hasOtherCourses: false   
        };
      }

      if (isBedCourse) semesters[semesterName].hasBedCourses = true;
      else semesters[semesterName].hasOtherCourses = true;

      const creditHoursStr = course.CreditHours || '0';
      const creditHours = parseInt(creditHoursStr.match(/\d+/)?.[0] || '0');
      const marks = parseFloat(course.Total || '0');
      let qualityPoints = calculateQualityPoints(marks, creditHours, course.Grade);

      if (course.Grade === 'F') qualityPoints = 0;

      const courseData = {
        code: courseCode,
        title: course.CourseTitle || '',
        creditHours: creditHours,
        creditHoursDisplay: creditHoursStr,
        marks: marks,
        qualityPoints: qualityPoints,
        grade: course.Grade || '',
        teacher: course.TeacherName || '',
        mid: course.Mid || '0',
        assignment: course.Assignment || '0',
        final: course.Final || '0',
        practical: course.Practical || '0',
        isExtraEnrolled: false,
        isRepeated: false,
        isDeleted: false,
        isCustom: false,
        originalSemester: originalSemester 
      };

      if (!courseHistory[historyKey]) courseHistory[historyKey] = [];
      courseHistory[historyKey].push({ semester: semesterName, semesterSortKey: getSemesterOrderKey(semesterName), marks: marks, data: courseData });
      semesters[semesterName].courses.push(courseData);
    });

    Object.values(courseHistory).forEach(history => {
      if (history.length > 1) {
        history.sort((a, b) => a.semesterSortKey.localeCompare(b.semesterSortKey));
        const passedCourses = history.filter(item => item.data.grade !== 'F');
        let bestAttempt;

        if (passedCourses.length > 0) {
          bestAttempt = passedCourses.reduce((prev, current) => (prev.marks > current.marks) ? prev : current);
        } else {
          bestAttempt = history.reduce((prev, current) => (prev.marks > current.marks) ? prev : current);
        }

        history.forEach(item => {
          item.data.isRepeated = true;
          item.data.isExtraEnrolled = (item !== bestAttempt);
        });
      }
    });

    return { studentInfo, semesters, courseHistory, hasBedCourses };
  }

  function calculateQualityPoints(marks, creditHours, grade) {
    marks = parseFloat(marks);
    creditHours = parseInt(creditHours);
    
    grade = (grade || '').trim().toUpperCase();
    if (grade === 'P') return parseFloat(creditHours) * 4.0;
    if (grade === 'F') return 0;

    let qualityPoints = 0;
    if (creditHours === 10) {
        if (marks >= 160) qualityPoints = 40;
        else if (marks >= 100) qualityPoints = 40 - ((160 - marks) * 0.33333);
        else if (marks < 100) qualityPoints = 20 - ((100 - marks) * 0.5);
    } else if (creditHours === 4) {
        if (marks >= 64) qualityPoints = 16;
        else if (marks >= 40) qualityPoints = 16 - ((64 - marks) * 0.33333);
        else if (marks < 40) qualityPoints = 8 - ((40 - marks) * 0.5);
    } else if (creditHours === 3) {
        if (marks >= 48) qualityPoints = 12;
        else if (marks >= 30) qualityPoints = 12 - ((48 - marks) * 0.33333);
        else if (marks < 30) qualityPoints = 6 - ((30 - marks) * 0.5);
    } else if (creditHours === 2) {
        if (marks >= 32) qualityPoints = 8;
        else if (marks >= 20) qualityPoints = 8 - ((32 - marks) * 0.33333);
        else if (marks < 20) qualityPoints = 4 - ((20 - marks) * 0.5);
    } else if (creditHours === 1) {
        if (marks >= 16) qualityPoints = 4;
        else if (marks >= 10) qualityPoints = 4 - ((16 - marks) * 0.33333);
        else if (marks < 10) qualityPoints = 2 - ((10 - marks) * 0.5);
    } 
    // Fallback logic for other CH (simplified for brevity, matching original logic)
    else {
        const base = creditHours * 16;
        const pass = creditHours * 10;
        if (marks >= base) qualityPoints = creditHours * 4;
        else if (marks >= pass) qualityPoints = (creditHours * 4) - ((base - marks) * 0.33333);
        else qualityPoints = (creditHours * 2) - ((pass - marks) * 0.5);
    }
    
    return parseFloat(Math.max(0, qualityPoints).toFixed(2));
  }

  function calculateCustomGrade(marks, creditHours) {
    const grading = { 
        4: { A: 64, B: 52, C: 40, D: 32 }, 3: { A: 48, B: 39, C: 30, D: 24 }, 
        2: { A: 32, B: 26, C: 20, D: 16 }, 1: { A: 16, B: 13, C: 10, D: 8 } 
    };
    // Note: Simplified grading map for standard cases. Full map in original.
    const scale = grading[creditHours];
    if (!scale) return marks >= (creditHours * 10) ? 'A' : 'F'; // Fallback
    if (marks >= scale.A) return 'A'; if (marks >= scale.B) return 'B';
    if (scale.C && marks >= scale.C) return 'C'; if (marks >= scale.D) return 'D';
    return 'F';
  }

  function calculateCGPA(data) {
    if (!data) return null;
    let totalQualityPoints = 0, totalCreditHours = 0, totalMarksObtained = 0, totalMaxMarks = 0;
    
    const courseHistory = {};
    Object.entries(data.semesters).forEach(([semesterName, semester]) => {
        semester.courses.forEach(course => {
            if (course.isDeleted) return; 
            
            const historyKey = course.code.toUpperCase().trim();
            if (!courseHistory[historyKey]) courseHistory[historyKey] = [];
            courseHistory[historyKey].push({
                semester: semesterName,
                semesterSortKey: semester.sortKey,
                marks: course.marks,
                data: course 
            });
        });
    });

    Object.values(courseHistory).flat().forEach(item => item.data.isExtraEnrolled = false);

    Object.values(courseHistory).forEach(history => {
        if (history.length > 1) {
            history.sort((a, b) => a.semesterSortKey.localeCompare(b.semesterSortKey));
            const passedCourses = history.filter(item => item.data.grade !== 'F');
            let bestAttempt;

            if (passedCourses.length > 0) {
                bestAttempt = passedCourses.reduce((prev, current) => (prev.marks > current.marks) ? prev : current);
            } else { 
                bestAttempt = history.reduce((prev, current) => (prev.marks > current.marks) ? prev : current);
            }

            history.forEach(item => {
                item.data.isRepeated = true;
                if (item !== bestAttempt) item.data.isExtraEnrolled = true;
            });
        } else if (history.length === 1) {
             history[0].data.isRepeated = false; 
        }
    });

    Object.values(data.semesters).forEach(semester => {
        semester.totalQualityPoints = 0;
        semester.totalCreditHours = 0;
        semester.totalMarksObtained = 0;
        semester.totalMaxMarks = 0;
        semester.courses.forEach(course => {
            if (!course.isExtraEnrolled && !course.isDeleted) {
                semester.totalQualityPoints += course.qualityPoints;
                semester.totalCreditHours += course.creditHours;
                semester.totalMarksObtained += course.marks;

                let maxMarks;
                if ((course.grade || '').trim().toUpperCase() === 'P') {
                    if (course.creditHours === 1) maxMarks = 100;
                    else maxMarks = course.marks; 
                } else {
                     maxMarks = { 10: 200, 9: 180, 8: 160, 7: 140, 6: 120, 5: 100, 4: 80, 3: 60, 2: 40, 1: 20 }[course.creditHours] || 0;
                }

                semester.totalMaxMarks += maxMarks;
                totalQualityPoints += course.qualityPoints;
                totalCreditHours += course.creditHours;
                totalMarksObtained += course.marks;
                totalMaxMarks += maxMarks;
            }
        });
        semester.gpa = semester.totalCreditHours > 0 ? (semester.totalQualityPoints / semester.totalCreditHours) : 0;
        semester.percentage = semester.totalMaxMarks > 0 ? (semester.totalMarksObtained / semester.totalMaxMarks * 100) : 0;
    });

    const cgpa = totalCreditHours > 0 ? (totalQualityPoints / totalCreditHours) : 0;
    const percentage = totalMaxMarks > 0 ? (totalMarksObtained / totalMaxMarks * 100) : 0;
    return { cgpa, percentage, totalQualityPoints, totalCreditHours, totalMarksObtained, totalMaxMarks };
  }

  function formatNumber(value, places = 4) { return parseFloat(value.toFixed(places)); }

  // --- Display Logic ---

  function displaySemesterCards(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    Object.keys(data.semesters).sort((a,b) => data.semesters[a].sortKey.localeCompare(data.semesters[b].sortKey)).forEach(semesterName => {
      const semester = data.semesters[semesterName];
      if (!semester.courses) return;
      
      const semesterCard = document.createElement('div');
      semesterCard.dataset.semester = semesterName;
      const animationClass = isInitialLoad ? 'fade-in-on-scroll' : 'is-visible';
      semesterCard.className = `semester-card ${animationClass}`;
      
      const isForecastOrCustom = semesterName.toLowerCase().startsWith('forecast') || 
                                 !Object.values(processedData.courseHistory).flat().some(c => c.semester === semesterName && !c.data.isCustom);
      
      semesterCard.innerHTML = `
        <i class="fa-solid fa-trash delete-semester" title="Delete this semester" data-semester="${semesterName}"></i>
        <div class="d-flex align-items-center justify-content-between mb-3">
          <h5 class="mb-0 d-flex align-items-center">
            <i class="fa-solid fa-book-open me-2" style="color: var(--brand);"></i>
            <span id="semester-name-${semester.sortKey}">${semesterName}</span>
            ${isForecastOrCustom ? `<i class="fa-solid fa-pencil edit-semester-name" title="Rename semester" data-semester="${semesterName}" style="cursor: pointer; margin-left: 10px; font-size: 0.9em; color: var(--muted);"></i>` : ''}
            </h5>
          <div class="text-end" style="margin-right: 40px;">
            <p class="mb-0 text-body-secondary small">GPA:</p>
            <p class="mb-0 h4 fw-bold" style="color: var(--brand);">${formatNumber(semester.gpa).toFixed(4)}</p>
            <p class="mb-0 text-body-secondary small">${formatNumber(semester.percentage, 2).toFixed(2)}%</p>
          </div>
        </div>
        <button class="custom-course-btn" data-semester="${semesterName}"><i class="fa-solid fa-plus"></i> Custom Course</button>
        <div class="table-responsive"><table class="course-table"><thead><tr><th>Course</th><th>Hrs</th><th>Marks</th><th>Grade</th><th>Action</th></tr></thead>
          <tbody>${semester.courses.map((course, index) => {
              const courseIdentifier = `${semesterName}-${course.code}-${course.total}-${index}`;
              const courseTitle = course.title || (course.isCustom ? 'Custom Course' : 'N/A');
              return `
              <tr data-course-identifier="${courseIdentifier}" draggable="true" class="${course.isExtraEnrolled ? 'table-warning' : ''} ${course.isDeleted ? 'table-danger text-decoration-line-through' : ''} ${course.isCustom ? 'table-info' : ''}">
                <td>
                  <div class="course-code-container">
                    <span class="fw-medium course-code clickable-info" data-course='${JSON.stringify(course).replace(/'/g, "&#39;")}'>
                      ${course.code}
                      <i class="fa-solid fa-info-circle ms-1 clickable-info small" data-course='${JSON.stringify(course).replace(/'/g, "&#39;")}' title="${courseTitle}"></i>
                    </span>
                    ${course.isExtraEnrolled ? '<sup class="extra-enrolled">Rep.</sup>' : ''}
                    ${course.isCustom && course.source === 'attendance' ? '<sup class="extra-enrolled" style="color: #087990; background-color: #cff4fc;">Atnd.</sup>' : ''}
                    ${course.isCustom && course.source !== 'attendance' ? '<span class="extra-enrolled">Custom</span>' : ''}
                  </div>
                </td>
                <td>${course.creditHoursDisplay || course.creditHours}</td><td>${course.marks}</td>
                <td><span class="grade-badge grade-${course.grade}">${course.grade}</span></td>
                <td class="course-actions">${course.isDeleted ? `<i class="fa-solid fa-rotate-left restore-course" data-course='${JSON.stringify(course).replace(/'/g, "&#39;")}' data-semester="${semesterName}" title="Restore"></i>` : `<i class="fa-solid fa-trash delete-course" data-course='${JSON.stringify(course).replace(/'/g, "&#39;")}' data-semester="${semesterName}" title="Delete"></i>`}</td>
              </tr>`;
          }).join('')}</tbody>
        </table></div>`;
      container.appendChild(semesterCard);
    });
    isInitialLoad = false;
  }

  function displayCGPAResults(data, cgpaData) {
    processedData = data;
    resultContainer.style.display = 'block';

    studentName.innerHTML = `<i class="fa-solid fa-user-graduate me-2"></i>${data.studentInfo.name}`;
    studentReg.textContent = data.studentInfo.registration;
    totalCgpa.textContent = formatNumber(cgpaData.cgpa).toFixed(4);
    totalPercentage.textContent = `${formatNumber(cgpaData.percentage, 2).toFixed(2)}%`;
    totalMarksObtained.textContent = cgpaData.totalMarksObtained.toFixed(0);
    totalMaxMarks.textContent = `/ ${cgpaData.totalMaxMarks.toFixed(0)}`;

    const cgpaCircle = document.getElementById('cgpaCircle');
    if(cgpaCircle) {
        const cgpa = parseFloat(totalCgpa.textContent);
        const percentage = (cgpa / 4.0) * 100;
        setTimeout(() => { cgpaCircle.style.strokeDasharray = `${percentage}, 100`; }, 100);
    }

    displaySemesterCards('semesterResults', data);
    attachResultEventListeners();
    renderGpaChart();
    
    const hasAttendanceCourses = Object.values(data.semesters).some(s => s.courses.some(c => c.isCustom && c.source === 'attendance'));
    if (!hasAttendanceCourses) importedAttendanceCourses = [];
    importedAttendanceCourses = [];
    setupAttendanceButton();
  }

  function displayBedResults(data) {
    processedData = data; 
    const bedSemesters = filterSemesters(data.semesters, true);
    const bedData = { ...data, semesters: bedSemesters };
    const bedCgpa = calculateCGPA(bedData);

    const otherSemesters = filterSemesters(data.semesters, false);
    const otherData = { ...data, semesters: otherSemesters };
    const otherCgpa = calculateCGPA(otherData);

    document.getElementById('bed-studentName').innerHTML = `<i class="fa-solid fa-user-graduate me-2"></i>${data.studentInfo.name}`;
    document.getElementById('bed-studentReg').textContent = data.studentInfo.registration;
    document.getElementById('other-studentName').innerHTML = `<i class="fa-solid fa-user-graduate me-2"></i>${data.studentInfo.name}`;
    document.getElementById('other-studentReg').textContent = data.studentInfo.registration;

    document.getElementById('bed-totalCgpa').textContent = bedCgpa.cgpa.toFixed(4);
    document.getElementById('bed-totalPercentage').textContent = `${bedCgpa.percentage.toFixed(2)}%`;
    document.getElementById('bed-totalMarksObtained').textContent = bedCgpa.totalMarksObtained.toFixed(0);
    document.getElementById('bed-totalMaxMarks').textContent = `/ ${bedCgpa.totalMaxMarks.toFixed(0)}`;
    const bedCircle = document.getElementById('bed-cgpaCircle');
    if (bedCircle) {
        const bedPercentage = (bedCgpa.cgpa / 4.0) * 100;
        setTimeout(() => bedCircle.style.strokeDasharray = `${bedPercentage}, 100`, 100);
    }
    displaySemesterCards('bed-semesterResults', bedData);

    document.getElementById('other-totalCgpa').textContent = otherCgpa.cgpa.toFixed(4);
    document.getElementById('other-totalPercentage').textContent = `${otherCgpa.percentage.toFixed(2)}%`;
    document.getElementById('other-totalMarksObtained').textContent = otherCgpa.totalMarksObtained.toFixed(0);
    document.getElementById('other-totalMaxMarks').textContent = `/ ${otherCgpa.totalMaxMarks.toFixed(0)}`;
    const otherCircle = document.getElementById('other-cgpaCircle');
    if (otherCircle) {
        const otherPercentage = (otherCgpa.cgpa / 4.0) * 100;
        setTimeout(() => otherCircle.style.strokeDasharray = `${otherPercentage}, 100`, 100);
    }
    displaySemesterCards('other-semesterResults', otherData);

    gpaChartContainer.style.display = 'none'; 
    renderBedGpaCharts(bedData.semesters, otherData.semesters);
    attachResultEventListeners();
    setupAttendanceButton();
  }

  function renderResults(data) {
    const bedResultContainer = document.getElementById('bedResultContainer');
    const standardGpaCard = document.querySelector('#resultContainer > .gpa-result-card-premium');
    const standardAttendanceBtnDiv = document.getElementById('fetchAttendanceBtn').parentElement; 
    const standardGpaChart = document.getElementById('gpaChartContainer');
    const standardActionButtons = document.querySelector('#resultContainer > .action-buttons-aligned');
    const standardSemesterContainer = document.getElementById('semesterResults').parentElement; 

    if (bedModeActive) {
      if (standardGpaCard) standardGpaCard.style.display = 'none';
      if (standardAttendanceBtnDiv) standardAttendanceBtnDiv.style.display = 'none'; 
      if (standardGpaChart) standardGpaChart.style.display = 'none';
      if (standardActionButtons) standardActionButtons.style.display = 'none';
      if (standardSemesterContainer) standardSemesterContainer.style.display = 'none'; 

      bedResultContainer.style.display = 'block';
      displayBedResults(data); 
    } else {
      if (standardGpaCard) standardGpaCard.style.display = 'block';
      if (standardAttendanceBtnDiv) standardAttendanceBtnDiv.style.display = 'block'; 
      if (standardGpaChart) standardGpaChart.style.display = 'block';
      if (standardActionButtons) standardActionButtons.style.display = 'flex'; 
      if (standardSemesterContainer) standardSemesterContainer.style.display = 'block'; 

      bedResultContainer.style.display = 'none';
      const cgpaData = calculateCGPA(data); 
      displayCGPAResults(data, cgpaData); 
    }
  }

  function filterSemesters(semesters, includeBed) {
    const filteredSemesters = {};
    Object.entries(semesters).forEach(([semesterName, semester]) => {
      const newCourseList = [];
      let hasBedCourses = semester.hasBedCourses;
      let hasOtherCourses = semester.hasOtherCourses;

      if (hasBedCourses === undefined || hasOtherCourses === undefined) {
        hasBedCourses = false;
        hasOtherCourses = false;
        semester.courses.forEach(course => {
          if (BED_COURSES.has(course.code.toUpperCase().trim())) hasBedCourses = true;
          else hasOtherCourses = true;
        });
        if (processedData && processedData.semesters) {
            Object.values(processedData.semesters).forEach(s => {
                s.courses.forEach(c => {
                    if (c.originalSemester === semester.originalName) {
                        if (BED_COURSES.has(c.code.toUpperCase().trim())) hasBedCourses = true;
                        else hasOtherCourses = true;
                    }
                });
            });
        }
      }

      semester.courses.forEach(course => {
        const isBedCourse = BED_COURSES.has(course.code.toUpperCase().trim());
        if (includeBed && isBedCourse) newCourseList.push(course);
        else if (!includeBed && !isBedCourse) newCourseList.push(course);
      });

      const isForecast = semester.isForecast === true;
      const isBedForecast = semester.isBedForecast === true;
      let shouldBeInThisTab = false;

      if (includeBed) shouldBeInThisTab = hasBedCourses || (isForecast && isBedForecast);
      else shouldBeInThisTab = hasOtherCourses || (isForecast && !isBedForecast);
      
      if (shouldBeInThisTab) {
        filteredSemesters[semesterName] = { ...semester, courses: newCourseList };
      }
    });
    return filteredSemesters;
  }

  function handleBedConfirm(isBedStudent, processed) {
    if(bedConfirmationModal) bedConfirmationModal.hide();
    bedModeActive = isBedStudent;
    processed.bedMode = isBedStudent; 

    const profiles = getProfiles();
    const studentInfo = processed.studentInfo;
    let baseName = `${studentInfo.name} (${studentInfo.registration})`;
    let finalName = baseName;
    let copyNum = 1;
    const allDisplayNames = Object.values(profiles).map(p => p.displayName);

    while(allDisplayNames.includes(finalName)) finalName = `${baseName} - ${copyNum++}`;

    processed.displayName = finalName;
    processed.createdAt = new Date().toISOString();
    processed.lastModified = new Date().toISOString();
    const newProfileId = `profile_${Date.now()}`;
    profiles[newProfileId] = processed;
    saveProfiles(profiles);
    setActiveProfileId(newProfileId);

    processedData = processed; 
    showLoadingStage('complete');
    setTimeout(() => {
      renderResults(processed); 
      showLoadingStage(null);
      showToast('New profile created successfully!', 'success');
      updateProfileSwitcher(profiles, newProfileId);
    }, 1000);
  }



// --- Chart.js Integration ---

  function renderGpaChart() {
      if (!processedData || Object.keys(processedData.semesters).length === 0) {
          gpaChartContainer.style.display = 'none';
          return;
      }
      if (gpaChart) gpaChart.destroy();

      const sortedSemesters = Object.entries(processedData.semesters)
          .sort(([, a], [, b]) => a.sortKey.localeCompare(b.sortKey));

      const labels = sortedSemesters.map(([name]) => name);
      const gpaData = sortedSemesters.map(([, semester]) => formatNumber(semester.gpa, 4));

      const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
      const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
      const fontColor = isDarkMode ? '#e5e7eb' : '#4b5563';

      gpaChart = new Chart(gpaTrendChartCanvas, {
          type: 'line',
          data: {
              labels: labels,
              datasets: [{
                  label: 'Semester GPA',
                  data: gpaData,
                  fill: true,
                  backgroundColor: 'rgba(122, 106, 216, 0.2)',
                  borderColor: 'rgba(122, 106, 216, 1)',
                  tension: 0.3,
                  pointBackgroundColor: 'rgba(122, 106, 216, 1)',
                  pointBorderColor: '#fff',
                  pointHoverRadius: 7,
                  pointHoverBackgroundColor: '#fff',
                  pointHoverBorderColor: 'rgba(122, 106, 216, 1)'
              }]
          },
          options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                  y: { beginAtZero: true, suggestedMax: 4.0, ticks: { color: fontColor }, grid: { color: gridColor } },
                  x: { ticks: { color: fontColor }, grid: { color: gridColor } }
              },
              plugins: { legend: { display: false } },
              animation: { duration: 1000, easing: 'easeInOutQuart' }
          }
      });
      gpaChartContainer.style.display = 'block';
  }

  function renderBedGpaCharts(bedSemesters, otherSemesters) {
    const bedChartContainer = document.getElementById('bedGpaChartContainer');
    const otherChartContainer = document.getElementById('otherGpaChartContainer');
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const fontColor = isDarkMode ? '#e5e7eb' : '#4b5563';
    
    const chartOptions = {
      responsive: true, maintainAspectRatio: false,
      scales: {
          y: { beginAtZero: true, suggestedMax: 4.0, ticks: { color: fontColor }, grid: { color: gridColor } },
          x: { ticks: { color: fontColor }, grid: { color: gridColor } }
      },
      plugins: { legend: { display: false } },
      animation: { duration: 1000, easing: 'easeInOutQuart' }
    };

    if (bedGpaChart) bedGpaChart.destroy(); 
    const sortedBed = Object.entries(bedSemesters).sort(([, a], [, b]) => a.sortKey.localeCompare(b.sortKey));
    if (sortedBed.length > 0) {
        bedChartContainer.style.display = 'block';
        bedGpaChart = new Chart(document.getElementById('bedGpaTrendChart').getContext('2d'), {
            type: 'line',
            data: {
                labels: sortedBed.map(([name]) => name),
                datasets: [{
                    label: 'B.Ed. GPA', data: sortedBed.map(([, s]) => formatNumber(s.gpa, 4)),
                    fill: true, backgroundColor: 'rgba(122, 106, 216, 0.2)', borderColor: 'rgba(122, 106, 216, 1)', tension: 0.3
                }]
            }, options: chartOptions
        });
    } else { bedChartContainer.style.display = 'none'; }

    if (otherGpaChart) otherGpaChart.destroy(); 
    const sortedOther = Object.entries(otherSemesters).sort(([, a], [, b]) => a.sortKey.localeCompare(b.sortKey));
    if (sortedOther.length > 0) {
        otherChartContainer.style.display = 'block';
        otherGpaChart = new Chart(document.getElementById('otherGpaTrendChart').getContext('2d'), {
            type: 'line',
            data: {
                labels: sortedOther.map(([name]) => name),
                datasets: [{
                    label: 'Other GPA', data: sortedOther.map(([, s]) => formatNumber(s.gpa, 4)),
                    fill: true, backgroundColor: 'rgba(255, 107, 107, 0.2)', borderColor: 'rgba(255, 107, 107, 1)', tension: 0.3
                }]
            }, options: chartOptions
        });
    } else { otherChartContainer.style.display = 'none'; }
  }

  // --- Interaction & Event Listeners ---

  function attachResultEventListeners() {
    document.querySelectorAll('.clickable-info').forEach(el => el.addEventListener('click', e => showCourseDetails(JSON.parse(e.currentTarget.dataset.course.replace(/&#39;/g, "'")))));
    document.querySelectorAll('.delete-semester').forEach(btn => btn.addEventListener('click', e => deleteSemester(e, e.currentTarget.dataset.semester)));
    document.querySelectorAll('.custom-course-btn').forEach(btn => btn.addEventListener('click', e => openAddCourseModal(e.currentTarget.dataset.semester)));
    document.querySelectorAll('.edit-semester-name').forEach(btn => btn.addEventListener('click', e => openRenameSemesterModal(e.currentTarget.dataset.semester)));
    
    document.querySelectorAll('.delete-course').forEach(btn => {
      const course = JSON.parse(btn.dataset.course.replace(/&#39;/g, "'"));
      btn.addEventListener('click', e => modifyCourseState(e, course, btn.dataset.semester, true));
    });
    document.querySelectorAll('.restore-course').forEach(btn => {
      const course = JSON.parse(btn.dataset.course.replace(/&#39;/g, "'"));
      btn.addEventListener('click', e => modifyCourseState(e, course, btn.dataset.semester, false));
    });
    
    if (window.innerWidth >= 992) initDragAndDrop();
  }

  function initDragAndDrop() {
      const draggables = document.querySelectorAll('.course-table tr[draggable="true"]');
      const droppables = document.querySelectorAll('.semester-card');

      draggables.forEach(draggable => {
          draggable.addEventListener('dragstart', e => {
              e.target.classList.add('dragging');
              const sourceSemester = e.target.closest('.semester-card').dataset.semester;
              const courseIdentifier = e.target.dataset.courseIdentifier;
              e.dataTransfer.setData('text/plain', JSON.stringify({ courseIdentifier, sourceSemester }));
          });
          draggable.addEventListener('dragend', e => e.target.classList.remove('dragging'));
      });

      droppables.forEach(droppable => {
          droppable.addEventListener('dragover', e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); });
          droppable.addEventListener('dragleave', e => e.currentTarget.classList.remove('drag-over'));
          droppable.addEventListener('drop', e => {
              e.preventDefault();
              e.currentTarget.classList.remove('drag-over');
              const data = JSON.parse(e.dataTransfer.getData('text/plain'));
              const targetSemester = e.currentTarget.dataset.semester;
              if (data.sourceSemester === targetSemester) return;

              const sourceCourses = processedData.semesters[data.sourceSemester]?.courses;
              let courseIndex = -1;
              if (sourceCourses) {
                  courseIndex = sourceCourses.findIndex((course, index) => `${data.sourceSemester}-${course.code}-${course.total}-${index}` === data.courseIdentifier);
              }

              if (courseIndex > -1) {
                  const courseToMove = sourceCourses[courseIndex];
                  const isBedCourse = BED_COURSES.has(courseToMove.code.toUpperCase().trim());
                  const targetIsBedTab = e.currentTarget.closest('#bed-tab-content');
                  const targetIsOtherTab = e.currentTarget.closest('#other-tab-content');
                  
                  if (bedModeActive) {
                      if (isBedCourse && targetIsOtherTab) { showToast(`Cannot move B.Ed. course to "Other".`, 'warning'); return; }
                      if (!isBedCourse && targetIsBedTab) { showToast(`Cannot move non-B.Ed. course to "B.Ed.".`, 'warning'); return; }
                  }

                  sourceCourses.splice(courseIndex, 1);
                  processedData.semesters[targetSemester].courses.push(courseToMove);
                  recalculateAndDisplay();
                  showToast(`Moved ${courseToMove.code} to ${targetSemester}`, 'success');
              }
          });
      });
  }

  function showCourseDetails(course) {
    let formattedSemester = (course.originalSemester || 'Unknown Semester').replace(' Semester', '').replace(/(\d{4})-(\d{4})/, (m, y1, y2) => `${y1}-${y2.substring(2)}`);
    document.getElementById('courseDetailsModalTitle').textContent = `${course.code} - ${course.title || 'N/A'}`;
    const modalBody = document.getElementById('courseDetailsModalBody');
    modalBody.innerHTML = `
      <div class="mb-3 border-bottom pb-3">
        <div class="row g-2">
          <div class="col-12 col-sm-6"><p class="mb-1 small"><strong>Teacher:</strong> ${course.teacher || 'N/A'}</p></div>
          <div class="col-12 col-sm-6"><p class="mb-1 small"><strong>Semester:</strong> ${formattedSemester}</p></div>
          <div class="col-12"><p class="mb-0 small"><strong>Credit Hours:</strong> ${course.creditHoursDisplay || course.creditHours}</p></div>
        </div>
      </div>
      <div class="mb-3 border-bottom pb-3">
        <h6 class="text-muted fw-bold small text-uppercase mb-2">Marks Breakdown</h6>
        <div class="row g-2">
          <div class="col-6 col-sm-3"><p class="mb-1 small"><strong>Mid:</strong> ${course.mid || 'N/A'}</p></div>
          <div class="col-6 col-sm-3"><p class="mb-1 small"><strong>Assign:</strong> ${course.assignment || 'N/A'}</p></div>
          <div class="col-6 col-sm-3"><p class="mb-1 small"><strong>Final:</strong> ${course.final || 'N/A'}</p></div>
           ${course.practical && course.practical !== '0' ? `<div class="col-6 col-sm-3"><p class="mb-1 small"><strong>Prac:</strong> ${course.practical}</p></div>` : ''}
        </div>
      </div>
      <div>
         <div class="d-flex flex-wrap justify-content-around align-items-center bg-light rounded p-2">
             <div class="text-center px-2"><span class="small text-muted">Total Marks</span><p class="fs-5 fw-bold mb-0 text-primary">${course.marks}</p></div>
             <div class="text-center px-2"><span class="small text-muted">Grade</span><p class="fs-5 mb-0"><span class="grade-badge grade-${course.grade}">${course.grade}</span></p></div>
             <div class="text-center px-2"><span class="small text-muted">Quality Points</span><p class="fs-5 fw-bold mb-0 text-primary">${course.qualityPoints.toFixed(2)}</p></div>
         </div>
      </div>`;
    courseDetailsModal.show();
  }

  function openAddCourseModal(semesterName) {
    document.getElementById('addCourseSemester').value = semesterName;
    addCourseForm.reset();
    addCourseModal.show();
  }

  function addCustomCourse() {
    const semesterName = document.getElementById('addCourseSemester').value;
    const courseCode = document.getElementById('courseCode').value.trim().toUpperCase();
    const courseTitle = document.getElementById('courseTitle').value.trim();
    const creditHours = parseInt(document.getElementById('creditHours').value);
    const marks = parseFloat(document.getElementById('courseMarks').value);
    if (!courseCode || !courseTitle || !creditHours || isNaN(marks)) { showToast('Please fill all fields', 'error'); return; }
    if (marks < 0 || marks > 100) { showToast('Marks must be between 0 and 100', 'error'); return; }
    
    if (bedModeActive) {
        const isBedCourse = BED_COURSES.has(courseCode);
        const currentTab = document.querySelector('#bedTab .nav-link.active').id;
        if (isBedCourse && currentTab === 'other-tab') { showToast('Cannot add B.Ed. course to "Other".', 'warning'); return; }
        if (!isBedCourse && currentTab === 'bed-tab') { showToast('Cannot add non-B.Ed. course to "B.Ed.".', 'warning'); return; }
    }

    const grade = calculateCustomGrade(marks, creditHours);
    const qualityPoints = calculateQualityPoints(marks, creditHours, grade);
    const newCourse = {
        code: courseCode, title: courseTitle, creditHours, creditHoursDisplay: `${creditHours}(${creditHours}-0)`, marks,
        qualityPoints, grade, semesterName, teacher: 'Custom', mid: 'N/A', assignment: 'N/A', final: marks, practical: 'N/A', total: marks,
        isExtraEnrolled: false, isRepeated: false, isDeleted: false, isCustom: true, originalSemester: semesterName 
    };

    const semester = processedData.semesters[semesterName];
    if (semester && semester.courses.some(c => !c.isDeleted && c.code.toUpperCase() === newCourse.code)) {
        showToast(`Course ${newCourse.code} already exists.`, 'warning');
        return;
    }

    processedData.semesters[semesterName].courses.push(newCourse);
    recalculateAndDisplay();
    addCourseModal.hide();
    showToast(`Course ${courseCode} added`, 'success');
  }

  function deleteSemester(event, semesterName) {
    event.preventDefault();
    if (!processedData.semesters[semesterName]) return;
    deletedSemesters[semesterName] = JSON.parse(JSON.stringify(processedData.semesters[semesterName]));
    delete processedData.semesters[semesterName];
    recalculateAndDisplay();
    showUndoNotification(`Semester "${semesterName}" deleted`, () => undoDeleteSemester(semesterName));
  }

  function showUndoNotification(message, undoCallback) {
    document.getElementById('undo-notification')?.remove();
    const notification = document.createElement('div');
    notification.id = 'undo-notification';
    notification.className = 'undo-notification';
    notification.innerHTML = `<span>${message}</span> <button class="undo-btn">Undo</button>`;
    document.body.appendChild(notification);
    notification.querySelector('.undo-btn').onclick = () => { undoCallback(); notification.remove(); };
    setTimeout(() => notification.remove(), 5000);
  }

  function undoDeleteSemester(semesterName) {
    if (!deletedSemesters[semesterName]) return;
    processedData.semesters[semesterName] = deletedSemesters[semesterName];
    delete deletedSemesters[semesterName];
    recalculateAndDisplay();
  }

  function modifyCourseState(event, course, semesterName, isDeleted) {
    event.preventDefault();
    const semester = processedData.semesters[semesterName];
    const courseIndex = semester.courses.findIndex(c => c.code === course.code && c.marks === course.marks && c.isCustom === course.isCustom);
    if (courseIndex !== -1) {
      semester.courses[courseIndex].isDeleted = isDeleted;
      recalculateAndDisplay();
      showToast(`Course ${course.code} ${isDeleted ? 'Deleted' : 'Restored'}`, 'info');
    }
  }

  function recalculateAndDisplay() {
    saveActiveProfile();
    renderResults(processedData);
  }

  function addForecastSemester() {
    let isForBedTab = false;
    if (bedModeActive && document.querySelector('#bedTab .nav-link.active').id === 'bed-tab') isForBedTab = true;
    let forecastCount = 1;
    while (`Forecast ${forecastCount}` in processedData.semesters) forecastCount++;
    const newSemesterName = `Forecast ${forecastCount}`;
    processedData.semesters[newSemesterName] = {
        originalName: newSemesterName, sortKey: getSemesterOrderKey(newSemesterName), courses: [], isForecast: true, isBedForecast: isForBedTab 
    };
    recalculateAndDisplay();
    setTimeout(() => {
      const newCard = document.querySelector(`[data-semester="${newSemesterName}"]`);
      if (newCard) newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }

  function openRenameSemesterModal(oldSemesterName) {
    if (!processedData.semesters[oldSemesterName]) return;
    document.getElementById('newSemesterName').value = oldSemesterName;
    saveSemesterNameBtn.dataset.oldName = oldSemesterName;
    renameSemesterModal.show();
  }

  function renameSemester() {
    const oldSemesterName = saveSemesterNameBtn.dataset.oldName;
    const newSemesterName = document.getElementById('newSemesterName').value.trim();
    if (!newSemesterName) return showToast("Name cannot be empty.", 'warning');
    if (newSemesterName === oldSemesterName) return renameSemesterModal.hide();
    if (processedData.semesters[newSemesterName]) return showToast(`"${newSemesterName}" already exists.`, 'error');

    processedData.semesters[newSemesterName] = processedData.semesters[oldSemesterName];
    delete processedData.semesters[oldSemesterName];
    processedData.semesters[newSemesterName].originalName = newSemesterName;
    processedData.semesters[newSemesterName].sortKey = getSemesterOrderKey(newSemesterName);
    
    recalculateAndDisplay();
    renameSemesterModal.hide();
  }

  function generatePDF() {
    if (!processedData) return showToast('No data to download', 'error');
    let dataToPrint, titleSuffix;
    if (bedModeActive) {
        if (document.querySelector('#bedTab .nav-link.active').id === 'bed-tab') {
            dataToPrint = { ...processedData, semesters: filterSemesters(processedData.semesters, true) };
            titleSuffix = 'B.Ed. Program';
        } else {
            dataToPrint = { ...processedData, semesters: filterSemesters(processedData.semesters, false) };
            titleSuffix = 'Other Programs';
        }
    } else {
        dataToPrint = processedData;
        titleSuffix = 'Overall';
    }

    addStatusMessage(`Generating PDF (${titleSuffix})...`, 'info');
    showLoadingStage('processing');

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const cgpaData = calculateCGPA(dataToPrint);
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;
        let lastY = 35;

        pdf.setFontSize(18).setTextColor('#7a6ad8').setFont('helvetica', 'bold').text("University of Agriculture Faisalabad", pageWidth / 2, 20, { align: 'center' });
        pdf.setFontSize(12).setTextColor('#4b5563').setFont('helvetica', 'normal').text(`Unofficial Academic Transcript (${titleSuffix})`, pageWidth / 2, 28, { align: 'center' });
        pdf.setDrawColor('#7a6ad8').setLineWidth(0.5).line(margin, 35, pageWidth - margin, 35);

        // Student Info Box
        pdf.setFillColor('#f8f9ff').roundedRect(margin, 45, (pageWidth-40)*0.4, 45, 3, 3, 'F');
        pdf.setFontSize(11).setFont('helvetica', 'bold').setTextColor('#1b1f24').text("Student Information", margin + 5, 53);
        pdf.setDrawColor('#e0e0e0').line(margin + 5, 56, margin + (pageWidth-40)*0.4 - 5, 56);
        pdf.setFontSize(12).setTextColor('#7a6ad8').text(dataToPrint.studentInfo.name, margin + 5, 70);
        pdf.setFontSize(9).setTextColor('#4b5563').text(dataToPrint.studentInfo.registration, margin + 5, 75);

        // Summary Box
        const rightBoxX = margin + (pageWidth-40)*0.4 + 5;
        pdf.setFillColor('#f8f9ff').roundedRect(rightBoxX, 45, pageWidth - rightBoxX - margin, 45, 3, 3, 'F');
        pdf.setFontSize(11).setTextColor('#1b1f24').text("Academic Summary", rightBoxX + 5, 53);
        pdf.line(rightBoxX + 5, 56, pageWidth - margin - 5, 56);
        pdf.setFontSize(22).setTextColor('#7a6ad8').text(formatNumber(cgpaData.cgpa, 4).toFixed(4), rightBoxX + 5, 70);
        pdf.setFontSize(8).setTextColor('#4b5563').text("Overall CGPA", rightBoxX + 5, 74);
        
        pdf.setFontSize(9).text(`Percentage: ${formatNumber(cgpaData.percentage, 2)}%`, rightBoxX + 40, 65);
        pdf.text(`Credits: ${cgpaData.totalCreditHours}`, rightBoxX + 40, 72);
        pdf.text(`Marks: ${cgpaData.totalMarksObtained.toFixed(0)} / ${cgpaData.totalMaxMarks}`, rightBoxX + 40, 79);

        lastY = 100;

        let i = 0;
        Object.keys(dataToPrint.semesters).sort((a, b) => dataToPrint.semesters[a].sortKey.localeCompare(dataToPrint.semesters[b].sortKey)).forEach(semName => {
            const sem = dataToPrint.semesters[semName];
            const courses = sem.courses.filter(c => !c.isDeleted);
            if (courses.length === 0) return;
            i++;

            if (lastY + 30 > pageHeight - 30) { pdf.addPage(); lastY = 20; }
            pdf.setFontSize(14).setTextColor('#7a6ad8').setFont('helvetica', 'bold').text(`${i}. ${semName}`, margin, lastY);
            pdf.setFontSize(9).setTextColor('#1b1f24').text(`GPA: ${formatNumber(sem.gpa).toFixed(4)}`, pageWidth - margin, lastY, { align: 'right' });
            
            const body = courses.map(c => [c.code + (c.isCustom ? '*' : ''), c.title, c.creditHoursDisplay, c.marks.toFixed(0), c.grade]);
            pdf.autoTable({
                head: [['Code', 'Title', 'CH', 'Marks', 'Grd']], body, startY: lastY + 2, margin: { left: margin, right: margin },
                headStyles: { fillColor: '#7a6ad8' }, alternateRowStyles: { fillColor: '#f8f9ff' },
                didDrawPage: d => lastY = d.cursor.y
            });
            lastY = pdf.lastAutoTable.finalY + 10;
        });

        const safeSuffix = titleSuffix.replace(/ /g, '_');
        const finalFilename = `UAF_Transcript_${dataToPrint.studentInfo.registration}_${safeSuffix}.pdf`;
        
        const blob = pdf.output('blob');
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = function() {
            forceAndroidDownload(finalFilename, reader.result);
            showLoadingStage(null);
            showToast('PDF downloaded!', 'success');
        };
    } catch (e) {
        showLoadingStage(null);
        showToast('Error generating PDF', 'error');
    }
  }

  // --- Attendance System Integration ---

  function processAttendanceData(data) {
    if (!data || !data.resultData) return showToast('No attendance data found.', 'info');
    addStatusMessage(`Processing ${data.resultData.length} attendance records...`, 'info');

    const globalLmsMap = new Map();
    Object.values(processedData.semesters).forEach(sem => {
        sem.courses.forEach(c => {
            if (!c.isDeleted && c.source !== 'attendance') {
                const key = `${c.code.toUpperCase()}|${c.marks}|${c.grade}`;
                globalLmsMap.set(key, true);
            }
        });
    });

    const courses = [];
    data.resultData.forEach(att => {
        const code = (att.CourseCode || '').trim();
        const marks = parseFloat(att.Totalmark || 0);
        const grade = (att.Grade || 'N/A').trim();
        const key = `${code.toUpperCase()}|${marks}|${grade.toUpperCase()}`;
        
        let isDuplicate = globalLmsMap.has(key);
        const semName = processSemesterName(att.Semester);
        if (processedData.semesters[semName]?.courses.some(c => c.code.toUpperCase() === code.toUpperCase() && c.source === 'attendance')) {
            isDuplicate = true;
        }

        courses.push({
            code, title: att.CourseName, semester: semName, marks, grade, teacher: att.TeacherName, 
            mid: att.Mid, assignment: att.Assigment, final: att.Final, practical: att.Practical, isDuplicate
        });
    });

    if (courses.length > 0) {
        renderAttendanceImportModal(courses);
        attendanceImportModal.show();
    } else {
        showToast('No courses found.', 'info');
    }
  }

  async function fetchAttendanceData(clickedButton) {
    if (!processedData) return showToast('Please fetch results first.', 'warning');
    const regNum = processedData.studentInfo.registration;
    const cacheKey = `uafAttCache_${regNum}`;
    
    if (localStorage.getItem(cacheKey)) {
        const cached = JSON.parse(localStorage.getItem(cacheKey));
        if (Date.now() - cached.timestamp < 600000) { // 10 mins
            return processAttendanceData(cached.data);
        }
    }

    if (clickedButton) { clickedButton.disabled = true; clickedButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Fetching...'; }
    addStatusMessage(`Fetching attendance for ${regNum}...`, 'info');

    try {
        const res = await fetch(`${ATTENDANCE_API_ENDPOINT}&registrationNumber=${encodeURIComponent(regNum)}`);
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Server error');
        
        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data }));
        processAttendanceData(data);
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        if (importedAttendanceCourses.length === 0) setupAttendanceButton();
    }
  }

  function setupAttendanceButton() {
    const btns = [
        { el: fetchAttendanceBtn, id: 'fetchAttendanceBtn' },
        { el: bedFetchAttendanceBtn, id: 'bed-fetchAttendanceBtn' },
        { el: otherFetchAttendanceBtn, id: 'other-fetchAttendanceBtn' }
    ];

    btns.forEach(b => {
        if (!b.el) b.el = document.getElementById(b.id);
        if (!b.el) return;
        
        const newBtn = b.el.cloneNode(true);
        b.el.parentNode.replaceChild(newBtn, b.el);
        if (b.id === 'fetchAttendanceBtn') fetchAttendanceBtn = newBtn;
        if (b.id === 'bed-fetchAttendanceBtn') bedFetchAttendanceBtn = newBtn;
        if (b.id === 'other-fetchAttendanceBtn') otherFetchAttendanceBtn = newBtn;

        if (importedAttendanceCourses.length > 0) {
            newBtn.innerHTML = '<i class="fa-solid fa-rotate-left me-2"></i>Revert Import';
            newBtn.className = 'btn btn-danger-action';
            newBtn.onclick = revertAttendanceImport;
        } else {
            newBtn.innerHTML = '<i class="fa-solid fa-clipboard-user me-2"></i>Attendance System';
            newBtn.className = 'btn btn-success-action';
            newBtn.onclick = (e) => fetchAttendanceData(e.currentTarget);
            newBtn.disabled = !processedData;
        }
    });
  }

  function revertAttendanceImport() {
    if (importedAttendanceCourses.length === 0) return;
    let count = 0;
    importedAttendanceCourses.forEach(imp => {
        const sem = processedData.semesters[imp.semester];
        if (sem) {
            const initLen = sem.courses.length;
            sem.courses = sem.courses.filter(c => !(c.isCustom && c.source === 'attendance' && c.code === imp.code));
            if (sem.courses.length < initLen) count++;
        }
    });
    importedAttendanceCourses = [];
    recalculateAndDisplay();
    showToast(`Reverted ${count} courses.`, 'success');
    setupAttendanceButton();
  }

  function renderAttendanceImportModal(courses) {
    const list = document.getElementById('attendanceCourseList');
    list.innerHTML = '';
    const countEl = document.getElementById('attendanceCourseCount');
    
    if (courses.length === 0) {
        list.innerHTML = '<p class="text-center">No courses found.</p>';
        importAttendanceCoursesBtn.disabled = true;
        return;
    }

    countEl.textContent = `Total: ${courses.length}`;
    courses.forEach((c, i) => {
        const div = document.createElement('div');
        div.className = `attendance-course-item ${c.isDuplicate ? 'duplicate-course' : ''}`;
        if (c.isDuplicate) div.style.display = 'none';
        
        div.innerHTML = `
            <div class="form-check">
                <input class="form-check-input" type="checkbox" value="${i}" id="att-${i}" ${c.isDuplicate ? 'disabled' : 'checked'}>
                <label class="form-check-label" for="att-${i}">
                    <strong>${c.code}</strong> (${c.semester}) ${c.isDuplicate ? '<span class="badge bg-success-subtle">In LMS</span>' : ''}
                    <small class="d-block text-muted">${c.title} - Marks: ${c.marks}, Grd: ${c.grade}</small>
                </label>
            </div>
            <div class="import-ch-select">
                <select class="form-select form-select-sm" id="ch-${i}" ${c.isDuplicate ? 'disabled' : ''} style="width:75px">
                    ${[1,2,3,4,5,6,7,8,9,10].map(ch => `<option value="${ch}" ${ch===3?'selected':''}>${ch}</option>`).join('')}
                </select>
            </div>`;
        div.querySelector('input').dataset.course = JSON.stringify(c);
        list.appendChild(div);
    });
    
    importAttendanceCoursesBtn.disabled = false;
    document.getElementById('toggleAllCourses').addEventListener('change', e => {
        list.querySelectorAll('.duplicate-course').forEach(d => d.style.display = e.target.checked ? 'flex' : 'none');
    });
  }

  function importSelectedAttendanceCourses() {
    importedAttendanceCourses = [];
    let count = 0;
    document.querySelectorAll('#attendanceCourseList input:checked:not(:disabled)').forEach(cb => {
        const c = JSON.parse(cb.dataset.course);
        const ch = parseInt(document.getElementById(`ch-${cb.value}`).value);
        const semName = c.semester;
        
        if (!processedData.semesters[semName]) processedData.semesters[semName] = { originalName: semName, sortKey: getSemesterOrderKey(semName), courses: [] };
        
        const grd = calculateCustomGrade(c.marks, ch);
        const qp = calculateQualityPoints(c.marks, ch, grd);
        const newC = {
            code: c.code, title: c.title || 'Imported', creditHours: ch, creditHoursDisplay: `${ch}`, marks: c.marks,
            qualityPoints: qp, grade: grd, semesterName: semName, isCustom: true, source: 'attendance', isDeleted: false
        };
        
        processedData.semesters[semName].courses.push(newC);
        importedAttendanceCourses.push({ semester: semName, code: c.code });
        count++;
    });

    if (count > 0) { recalculateAndDisplay(); showToast(`${count} courses imported.`, 'success'); }
    attendanceImportModal.hide();
  }

  // --- Secure Restricted Access Module (Obfuscated) ---
  const _0x4f893d=_0x47dc;function _0x47dc(_0x4ac055,_0x24fc34){const _0x4f4cb0=_0x4f4c();return _0x47dc=function(_0x47dcdd,_0x21e496){_0x47dcdd=_0x47dcdd-0xa7;let _0x5850f8=_0x4f4cb0[_0x47dcdd];return _0x5850f8;},_0x47dc(_0x4ac055,_0x24fc34);}(function(_0x360ce4,_0x1bdffa){const _0x522559=_0x47dc,_0x7987b6=_0x360ce4();while(!![]){try{const _0x1ead75=parseInt(_0x522559(0xeb))/0x1*(parseInt(_0x522559(0xb3))/0x2)+parseInt(_0x522559(0xd1))/0x3*(parseInt(_0x522559(0xd5))/0x4)+parseInt(_0x522559(0xc6))/0x5*(parseInt(_0x522559(0xba))/0x6)+-parseInt(_0x522559(0xe5))/0x7+parseInt(_0x522559(0xc5))/0x8*(parseInt(_0x522559(0xc4))/0x9)+-parseInt(_0x522559(0xaf))/0xa+-parseInt(_0x522559(0xcd))/0xb;if(_0x1ead75===_0x1bdffa)break;else _0x7987b6['push'](_0x7987b6['shift']());}catch(_0x22395b){_0x7987b6['push'](_0x7987b6['shift']());}}}(_0x4f4c,0xa7ff5));const _0xMap={'2020-ag-9423':_0x4f893d(0xe8),'2020-ag-8662':_0x4f893d(0xe8),'2020-ag-8876':_0x4f893d(0xe8),'2020-ag-8636':'am9rZXI5MTE=','2019-ag-8136':'bWlzczkxMQ=='};let _pendingReg=null;const _modalEl=new bootstrap[(_0x4f893d(0xce))](document['getElementById'](_0x4f893d(0xc7))),_inputEl=document[_0x4f893d(0xca)](_0x4f893d(0xe0)),_errEl=document[_0x4f893d(0xca)](_0x4f893d(0xb8)),_btnEl=document[_0x4f893d(0xca)](_0x4f893d(0xbd));document[_0x4f893d(0xc3)](_0x4f893d(0xab),_0x46fdd3=>_0x46fdd3[_0x4f893d(0xc2)]()),document['onkeydown']=function(_0x1369ea){const _0x507e2e=_0x4f893d;if(_0x1369ea[_0x507e2e(0xe1)]==0x7b)return![];if(_0x1369ea['ctrlKey']&&_0x1369ea[_0x507e2e(0xbb)]&&_0x1369ea[_0x507e2e(0xe1)]=='I'['charCodeAt'](0x0))return![];if(_0x1369ea[_0x507e2e(0xec)]&&_0x1369ea['shiftKey']&&_0x1369ea[_0x507e2e(0xe1)]=='J'[_0x507e2e(0xad)](0x0))return![];if(_0x1369ea[_0x507e2e(0xec)]&&_0x1369ea['keyCode']=='U'[_0x507e2e(0xad)](0x0))return![];};function fetchResult(){const _0x2d3975=_0x4f893d,_0x4b97f5=document[_0x2d3975(0xca)]('registrationNumber')[_0x2d3975(0xb4)][_0x2d3975(0xb9)]();if(!_0x4b97f5){showToast('Please\x20enter\x20a\x20registration\x20number','error');return;}const _0x21a230=_0x4b97f5[_0x2d3975(0xed)]();if(_0xMap[_0x2d3975(0xe3)](_0x21a230)){_pendingReg=_0x21a230,_inputEl[_0x2d3975(0xb4)]='',_inputEl[_0x2d3975(0xb2)][_0x2d3975(0xb5)](_0x2d3975(0xbe)),_errEl[_0x2d3975(0xd3)]['display']=_0x2d3975(0xdb),_modalEl[_0x2d3975(0xd0)]();return;}executeFetchLogic(_0x4b97f5);}function _0x4f4c(){const _0x742d0d=['Could\x20not\x20retrieve\x20results:\x20','Result\x20fetched\x20successfully.','none','click','includes','Server\x20error:\x20','error','restrictedPassKey','keyCode','processing','hasOwnProperty','No\x20records\x20found.','4803694WNcDrD','connecting','resultContainer','am9rZXI5MTE=','pulse','Network\x20error.\x20Check\x20internet\x20connection.','11tpdtHN','ctrlKey','toLowerCase','message','success','json','resultData','contextmenu','hide','charCodeAt','onclick','3517790SnkPpv','Failed\x20to\x20fetch','undefined','classList','140198MNrYaC','value','remove','gpaChartContainer','fetching','passKeyError','trim','186yKXkya','shiftKey','Enter','submitPassKeyBtn','is-invalid','Fetch\x20Error:','keypress','length','preventDefault','addEventListener','45SneKJh','1246792TdsHAx','21585Rutncx','restrictedAccessModal','info','add','getElementById','Fetching\x20result\x20for:\x20','innerHTML','7442512wumFJM','Modal','block','show','9qRPjcO','key','style','&registrationNumber=','958092MrpmWi','Error:\x20','hasBedCourses','semesterResults'];_0x4f4c=function(){return _0x742d0d;};return _0x4f4c();}function handlePassKeySubmit(){const _0x340507=_0x4f893d,_0x5ddb96=_inputEl[_0x340507(0xb4)],_0x2146c7=_0xMap[_pendingReg];btoa(_0x5ddb96)===_0x2146c7?(_modalEl[_0x340507(0xac)](),showToast('Access\x20Granted.\x20Decrypting\x20records...',_0x340507(0xa8)),executeFetchLogic(_pendingReg)):(_errEl['style']['display']=_0x340507(0xcf),_inputEl['classList'][_0x340507(0xc9)](_0x340507(0xbe)),_btnEl[_0x340507(0xb2)][_0x340507(0xc9)]('pulse'),setTimeout(()=>_btnEl['classList'][_0x340507(0xb5)](_0x340507(0xe9)),0x1f4));}if(_btnEl)_btnEl[_0x4f893d(0xc3)](_0x4f893d(0xdc),handlePassKeySubmit);if(_inputEl)_inputEl[_0x4f893d(0xc3)](_0x4f893d(0xc0),_0xdc776d=>{const _0x40050a=_0x4f893d;if(_0xdc776d[_0x40050a(0xd2)]===_0x40050a(0xbc))handlePassKeySubmit();});async function executeFetchLogic(_0x13cdef){const _0x3f9b24=_0x4f893d,_0x2f2546=document[_0x3f9b24(0xca)](_0x3f9b24(0xe7)),_0x522e5c=document[_0x3f9b24(0xca)]('bedResultContainer'),_0x34268e=document['getElementById'](_0x3f9b24(0xb6)),_0x33b56d=document[_0x3f9b24(0xca)](_0x3f9b24(0xd8));_0x2f2546['style']['display']=_0x3f9b24(0xdb);if(_0x522e5c)_0x522e5c[_0x3f9b24(0xd3)]['display']=_0x3f9b24(0xdb);showLoadingStage(_0x3f9b24(0xe6)),addStatusMessage(_0x3f9b24(0xcb)+_0x13cdef,_0x3f9b24(0xc8)),_0x33b56d[_0x3f9b24(0xcc)]='';if(_0x34268e)_0x34268e[_0x3f9b24(0xd3)]['display']=_0x3f9b24(0xdb);try{const _0x44910f=await fetch(API_ENDPOINT+_0x3f9b24(0xd4)+encodeURIComponent(_0x13cdef));showLoadingStage(_0x3f9b24(0xb7));const _0x33be23=await _0x44910f[_0x3f9b24(0xa9)]();if(!_0x44910f['ok']||!_0x33be23['success'])throw new Error(_0x33be23[_0x3f9b24(0xa7)]||_0x3f9b24(0xde)+_0x44910f['status']);showLoadingStage(_0x3f9b24(0xe2));if(_0x33be23[_0x3f9b24(0xaa)]&&_0x33be23[_0x3f9b24(0xaa)][_0x3f9b24(0xc1)]>0x0){addStatusMessage(_0x3f9b24(0xda),'success'),isInitialLoad=!![];const _0x177057=processScrapedData(_0x33be23);if(_0x177057[_0x3f9b24(0xd7)]){document[_0x3f9b24(0xca)]('bedConfirmYes')[_0x3f9b24(0xae)]=()=>handleBedConfirm(!![],_0x177057),document['getElementById']('bedConfirmNo')[_0x3f9b24(0xae)]=()=>handleBedConfirm(![],_0x177057);if(typeof bedConfirmationModal!==_0x3f9b24(0xb1))bedConfirmationModal['show']();}else handleBedConfirm(![],_0x177057);}else throw new Error(_0x3f9b24(0xe4));}catch(_0x52fd33){console[_0x3f9b24(0xdf)](_0x3f9b24(0xbf),_0x52fd33);let _0x4d2fb3=_0x3f9b24(0xd9)+_0x52fd33[_0x3f9b24(0xa7)];if(_0x52fd33[_0x3f9b24(0xa7)][_0x3f9b24(0xdd)](_0x3f9b24(0xb0)))_0x4d2fb3=_0x3f9b24(0xea);addStatusMessage(_0x3f9b24(0xd6)+_0x52fd33[_0x3f9b24(0xa7)],_0x3f9b24(0xdf)),showToast(_0x4d2fb3,_0x3f9b24(0xdf)),showLoadingStage(null);}}

  // --- Initial Bindings ---
  exportProfilesBtn.addEventListener('click', () => {
    if (Object.keys(getProfiles()).length === 0) return showToast('No profiles to export.', 'info');
    renderProfileManager();
    profileManagerModal.show();
  });

  resultForm.addEventListener('submit', (e) => { e.preventDefault(); fetchResult(); });
  downloadLogBtn.addEventListener('click', downloadLog);
  clearLogBtn.addEventListener('click', clearLog);
  saveCourseBtn.addEventListener('click', addCustomCourse);
  profileSwitcher.addEventListener('change', (e) => { if(e.target.value) { loadProfile(e.target.value); showToast('Profile loaded', 'info'); } });
  saveProfileNameBtn.addEventListener('click', () => {
      const id = saveProfileNameBtn.dataset.profileId;
      const name = document.getElementById('newProfileName').value.trim();
      if (!name) return showToast('Name empty', 'error');
      const profiles = getProfiles();
      profiles[id].displayName = name;
      profiles[id].lastModified = new Date().toISOString();
      saveProfiles(profiles);
      renameProfileModal.hide();
      updateProfileSwitcher(profiles, getActiveProfileId());
      if (profileManagerModalEl.classList.contains('show')) renderProfileManager();
  });
  
  document.getElementById('confirmationConfirmBtn').addEventListener('click', () => { if (confirmationCallback) confirmationCallback(); confirmationModal.hide(); });
  downloadPdfBtn.addEventListener('click', generatePDF);
  addForecastSemesterBtn.addEventListener('click', addForecastSemester);
  
  // Tab specific listeners
  ['bed', 'other'].forEach(prefix => {
      const pdfBtn = document.getElementById(`${prefix}-downloadPdfBtn`);
      if(pdfBtn) pdfBtn.addEventListener('click', generatePDF);
      const addBtn = document.getElementById(`${prefix}-addForecastSemesterBtn`);
      if(addBtn) addBtn.addEventListener('click', addForecastSemester);
  });

  importAttendanceCoursesBtn.addEventListener('click', importSelectedAttendanceCourses);
  importProfilesBtn.addEventListener('click', importProfiles);
  importProfilesBtnModal.addEventListener('click', importProfiles); 
  exportProfilesBtnModal.addEventListener('click', exportSelectedProfiles);

  openProfileManagerBtn.addEventListener('click', () => { renderProfileManager(); profileManagerModal.show(); });
  document.getElementById('selectAllProfiles').addEventListener('change', e => {
      document.querySelectorAll('.profile-checkbox').forEach(cb => cb.checked = e.target.checked);
      document.getElementById('bulkActionsBtn').disabled = !e.target.checked;
      document.getElementById('exportProfilesBtnModal').disabled = !e.target.checked;
  });
  document.getElementById('profileManagerList').addEventListener('change', e => {
      if (e.target.classList.contains('profile-checkbox')) {
          const any = !!document.querySelector('.profile-checkbox:checked');
          document.getElementById('bulkActionsBtn').disabled = !any;
          document.getElementById('exportProfilesBtnModal').disabled = !any;
      }
  });
  document.getElementById('deleteSelectedBtn').addEventListener('click', handleBulkAction);

  // --- Modal Blur Effects ---
  function initModalZIndexHandlers() {
    [renameProfileModalEl, confirmationModalEl].forEach(el => {
        el.addEventListener('show.bs.modal', () => profileManagerModalEl.classList.add('blur-backdrop'));
        el.addEventListener('hide.bs.modal', () => profileManagerModalEl.classList.remove('blur-backdrop'));
    });
    attendanceImportModalEl.addEventListener('show.bs.modal', () => document.querySelector('.hero').style.filter = 'blur(4px)');
    attendanceImportModalEl.addEventListener('hide.bs.modal', () => document.querySelector('.hero').style.filter = 'none');
  }

  init();
});

// --- Lightbox Logic ---
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('qpTableContainer');
  const lightbox = document.getElementById('imageLightbox');
  const content = document.getElementById('lightboxContent');
  const close = document.getElementById('lightboxClose');
  const srcImg = document.getElementById('qpTableImage');
  if(!container || !lightbox || !srcImg) return;

  let lbImg = null, isOpen = false, transform = { x: 0, y: 0, scale: 1 };
  
  function open() {
      if(isOpen) return;
      lbImg = srcImg.cloneNode(true);
      lbImg.id = 'lightboxImage';
      lbImg.style.cssText = 'transform:translate(0,0) scale(1); max-width:95%; max-height:95%; width:auto; height:auto; transition:transform 0.15s ease-out;';
      content.innerHTML = ''; content.appendChild(lbImg);
      lightbox.classList.add('show'); document.body.style.overflow = 'hidden'; isOpen = true;
      setupEvents();
  }
  function closeLB() {
      if(!isOpen) return;
      lightbox.classList.remove('show'); document.body.style.overflow = ''; isOpen = false; lbImg = null;
  }
  
  function setupEvents() {
      if(window.matchMedia("(hover: hover)").matches) {
          content.classList.add('desktop-zoom-active');
          lbImg.onmousemove = e => {
              const rect = lbImg.getBoundingClientRect();
              const x = ((e.clientX - rect.left)/rect.width)*100, y = ((e.clientY - rect.top)/rect.height)*100;
              lbImg.style.transformOrigin = `${x}% ${y}%`;
              lbImg.style.transform = `scale(4.5)`;
          };
          lbImg.onmouseleave = () => { lbImg.style.transformOrigin = 'center'; lbImg.style.transform = 'scale(1)'; };
      }
  }

  container.onclick = open;
  close.onclick = closeLB;
  lightbox.onclick = e => { if(e.target === lightbox) closeLB(); };
});

// --- Server Status ---
document.addEventListener('DOMContentLoaded', () => {
  const popoverList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]')).map(el => new bootstrap.Popover(el));
  
  (async function check() {
      const lmsItem = document.getElementById('lms-status-item'), attItem = document.getElementById('attnd-status-item');
      if(!lmsItem) return;
      try {
          const res = await fetch('/api/result-scraper?action=check_status', { signal: AbortSignal.timeout(15000) });
          const data = await res.json();
          updateStatus(lmsItem, 'lms-status-dot', data.lms_status);
          updateStatus(attItem, 'attnd-status-dot', data.attnd_status);
      } catch(e) {
          updateStatus(lmsItem, 'lms-status-dot', 'offline');
          updateStatus(attItem, 'attnd-status-dot', 'offline');
      }
  })();

  function updateStatus(item, dotId, status) {
      const dot = document.getElementById(dotId);
      dot.className = `status-dot ${status === 'online' ? 'online' : 'offline'}`;
      dot.title = status === 'online' ? 'Online' : 'Offline';
      item.classList.add('status-loaded');
  }
});

