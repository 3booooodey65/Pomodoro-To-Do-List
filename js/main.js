document.addEventListener('DOMContentLoaded', () => {
        let tasks = [];
        let activeTimers = {};
        let currentFilter = 'all';
        let currentSort = 'time-asc';
        let taskToDeleteId = null;
        let audioStarted = false;

        let pomodoroState = 'stopped';
        let pomodoroMode = 'pomodoro';
        let pomodoroSettings = { pomodoro: 25, short: 5, long: 15 };
        let pomodoroTimeLeft = pomodoroSettings.pomodoro * 60;
        let pomodoroEndTime = 0;
        let pomodoroInterval = null;

        const taskForm = document.getElementById('task-form');
        const taskListContainer = document.getElementById('task-list-container');
        const primaryColorPicker = document.getElementById('primaryColorPicker');
        const secondaryColorPicker = document.getElementById('secondaryColorPicker');
        const appToast = new bootstrap.Toast(document.getElementById('app-toast'));
        const deleteModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
        const pomodoroSettingsModal = new bootstrap.Modal(document.getElementById('pomodoroSettingsModal'));
        const taskStartAlertModal = new bootstrap.Modal(document.getElementById('taskStartAlertModal'));
        const taskTitleInput = document.getElementById('task-title');
        const navBar = document.querySelector('.navbar');

        const pomodoroDisplay = document.getElementById('pomodoro-timer');
        const pomodoroStartPauseBtn = document.getElementById('pomodoro-start-pause');
        const pomodoroResetBtn = document.getElementById('pomodoro-reset');
        const pomodoroModeBtns = {
            pomodoro: document.getElementById('pomodoro-mode-pomodoro'),
            short: document.getElementById('pomodoro-mode-short'),
            long: document.getElementById('pomodoro-mode-long')
        };
        
        function initializeApp() {
            loadTheme();
            loadColors();
            loadPomodoroSettings();
            loadTasks();
            fetchAIQuote();
            setupEventListeners();
            requestNotificationPermission();
            renderTasks();
            switchPomodoroMode('pomodoro');
        }

        async function startAudio() {
            if (audioStarted) return;
            await Tone.start();
            audioStarted = true;
        }

        function playSound(type) {
            if (!audioStarted) return;
            const now = Tone.now();
            if (type === 'add') {
                const synth = new Tone.Synth().toDestination();
                synth.triggerAttackRelease("C4", "16n", now);
            } else if (type === 'complete') {
                const synth = new Tone.Synth().toDestination();
                synth.triggerAttackRelease("C5", "8n", now);
            } else if (type === 'reminder' || type === 'startAlert') {
                const synth = new Tone.Synth().toDestination();
                synth.triggerAttackRelease("E5", "16n", now);
                synth.triggerAttackRelease("G5", "16n", now + 0.1);
            } else if (type === 'pomodoroEnd') {
                const synth = new Tone.Synth().toDestination();
                synth.triggerAttackRelease("C5", "8n", now);
                synth.triggerAttackRelease("E5", "8n", now + 0.2);
                synth.triggerAttackRelease("G5", "8n", now + 0.4);
            }
        }

        function loadTheme() {
            const savedTheme = localStorage.getItem('appTheme') || 'light';
            setTheme(savedTheme);
        }
        window.setTheme = function(theme) {
            document.documentElement.setAttribute('data-bs-theme', theme);
            localStorage.setItem('appTheme', theme);
        }

        function loadColors() {
            const primary = localStorage.getItem('primaryColor') || '#0d6efd';
            const secondary = localStorage.getItem('secondaryColor') || '#6c757d';
            primaryColorPicker.value = primary;
            secondaryColorPicker.value = secondary;
            applyColors(primary, secondary);
        }
        function applyColors(primary, secondary) {
            document.documentElement.style.setProperty('--custom-primary', primary);
            document.documentElement.style.setProperty('--custom-secondary', secondary);
            localStorage.setItem('primaryColor', primary);
            localStorage.setItem('secondaryColor', secondary);
        }

        function loadPomodoroSettings() {
            const savedSettings = JSON.parse(localStorage.getItem('pomodoroSettings'));
            if (savedSettings) {
                pomodoroSettings = savedSettings;
            }
            document.getElementById('setting-pomodoro').value = pomodoroSettings.pomodoro;
            document.getElementById('setting-short').value = pomodoroSettings.short;
            document.getElementById('setting-long').value = pomodoroSettings.long;
        }

        function savePomodoroSettings() {
            pomodoroSettings.pomodoro = parseInt(document.getElementById('setting-pomodoro').value) || 25;
            pomodoroSettings.short = parseInt(document.getElementById('setting-short').value) || 5;
            pomodoroSettings.long = parseInt(document.getElementById('setting-long').value) || 15;
            localStorage.setItem('pomodoroSettings', JSON.stringify(pomodoroSettings));
            showToast("نجاح", "تم حفظ إعدادات بومودورو.", "success");
            pomodoroSettingsModal.hide();
            switchPomodoroMode(pomodoroMode);
        }

        function saveTasks() { localStorage.setItem('tasks', JSON.stringify(tasks)); }
        function loadTasks() {
            tasks = JSON.parse(localStorage.getItem('tasks')) || [];
            tasks.forEach(task => {
                if (task.status === 'in-progress' && task.countdownEndTime) {
                    startCountdown(task.id);
                }
            });
        }

        function renderTasks() {
            taskListContainer.innerHTML = '';
            let filteredTasks = tasks.filter(task => currentFilter === 'all' || task.status === currentFilter);
            const priorityMap = { high: 3, medium: 2, low: 1 };
            filteredTasks.sort((a, b) => {
                if (currentSort === 'priority') return (priorityMap[b.priority] || 0) - (priorityMap[a.priority] || 0);
                if (currentSort === 'time-desc') return new Date(a.createdAt) - new Date(b.createdAt);
                return new Date(b.createdAt) - new Date(a.createdAt);
            });
            if (filteredTasks.length === 0) {
                taskListContainer.innerHTML = `<div class="text-center p-5 bg-body-secondary rounded"><i class="fas fa-folder-open fa-3x text-secondary mb-3"></i><p class="h5">لا توجد مهام لعرضها.</p></div>`;
                return;
            }
            filteredTasks.forEach(task => taskListContainer.appendChild(createTaskCard(task)));
        }

        function createTaskCard(task) {
            const card = document.createElement('div');
            card.className = `card task-card mb-3 shadow-sm status-${task.status} priority-${task.priority}`;
            card.dataset.id = task.id;
            const statusText = { pending: 'قادمة', 'in-progress': 'جارية', completed: 'مكتملة' };
            const statusIcon = { pending: 'fa-hourglass-start', 'in-progress': 'fa-person-running', completed: 'fa-check-circle' };
            const statusColor = { pending: 'text-secondary', 'in-progress': 'text-primary', completed: 'text-success' };
            const isOverdue = new Date() > new Date(task.endDate) && task.status !== 'completed';
            let timerHTML = task.status === 'in-progress' ? `<span class="countdown-timer ms-2" id="timer-${task.id}">--:--:--</span>` : '';
            card.innerHTML = `
                <div class="card-body" dir="rtl">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h5 class="card-title task-title mb-1">${task.title}</h5>
                            <p class="card-text text-muted small">${task.description || ''}</p>
                        </div>
                        <div class="task-actions">
                            <button class="btn btn-sm btn-outline-secondary" onclick="handleEdit('${task.id}')" title="تعديل"><i class="fas fa-edit"></i></button>
                            ${task.status !== 'completed' ? `<button class="btn btn-sm btn-outline-success" onclick="markAsComplete('${task.id}')" title="إكمال"><i class="fas fa-check"></i></button>` : ''}
                            <button class="btn btn-sm btn-outline-danger" onclick="handleDelete('${task.id}')" title="حذف"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                    <hr>
                    <div class="d-flex flex-wrap justify-content-between align-items-center small text-muted">
                        <span class="mb-2 mb-md-0 ${statusColor[task.status]}"><i class="fas ${statusIcon[task.status]} fa-fw me-1"></i><strong>الحالة:</strong> ${statusText[task.status]}</span>
                        <span class="mb-2 mb-md-0 ${isOverdue ? 'text-danger fw-bold' : ''}"><i class="fas fa-calendar-times fa-fw me-1"></i><strong>تنتهي في:</strong> ${new Date(task.endDate).toLocaleString('ar-EG')}</span>
                    </div>
                    <div class="mt-3 d-flex justify-content-between align-items-center">
                        <div>${getControlButton(task)}</div>
                        ${timerHTML}
                    </div>
                </div>`;
            return card;
        }

        function getControlButton(task) {
            if (task.status === 'pending') return `<button class="btn btn-sm btn-primary" onclick="startCountdown('${task.id}')"><i class="fas fa-play"></i> بدء</button>`;
            if (task.status === 'in-progress') return `<button class="btn btn-sm btn-warning" onclick="stopCountdown('${task.id}')"><i class="fas fa-pause"></i> إيقاف مؤقت</button>`;
            return `<span class="text-success fw-bold"><i class="fas fa-check"></i> مكتملة</span>`;
        }
        
        function cancelEdit() {
            taskForm.reset();
            document.getElementById('task-id').value = '';
            document.getElementById('form-button-text').textContent = 'إضافة المهمة';
            document.getElementById('cancel-edit-btn').style.display = 'none';
            document.getElementById('gemini-breakdown-btn').style.display = 'none';
        }

        function handleFormSubmit(e) {
            e.preventDefault();
            startAudio();
            const id = document.getElementById('task-id').value;
            if (new Date(document.getElementById('task-end').value) <= new Date(document.getElementById('task-start').value)) {
                showToast("خطأ", "وقت الانتهاء يجب أن يكون بعد وقت البدء.", "danger");
                return;
            }
            const taskData = {
                title: taskTitleInput.value.trim(),
                description: document.getElementById('task-desc').value.trim(),
                priority: document.querySelector('input[name="priority"]:checked').value,
                startDate: document.getElementById('task-start').value,
                endDate: document.getElementById('task-end').value,
                reminder: parseInt(document.getElementById('task-reminder').value) || null,
            };
            if (id) {
                const taskIndex = tasks.findIndex(t => t.id === id);
                if (taskIndex > -1) {
                    tasks[taskIndex] = { ...tasks[taskIndex], ...taskData };
                    showToast("نجاح", "تم تحديث المهمة.", "success");
                }
            } else {
                const newTask = {
                    ...taskData,
                    id: 'task-' + Date.now(),
                    status: 'pending',
                    createdAt: new Date().toISOString(),
                    remainingTime: (new Date(taskData.endDate) - new Date(taskData.startDate)) / 1000,
                    countdownEndTime: null,
                };
                tasks.push(newTask);
                playSound('add');
                scheduleNotification(newTask);
                scheduleStartAlert(newTask);
                showToast("نجاح", "تمت إضافة المهمة.", "success");
            }
            saveTasks();
            renderTasks();
            cancelEdit();
        }

        window.handleEdit = function(id) {
            const task = tasks.find(t => t.id === id);
            if (!task) return;
            document.getElementById('task-id').value = task.id;
            taskTitleInput.value = task.title;
            document.getElementById('task-desc').value = task.description;
            document.getElementById(`priority-${task.priority}`).checked = true;
            document.getElementById('task-start').value = task.startDate;
            document.getElementById('task-end').value = task.endDate;
            document.getElementById('task-reminder').value = task.reminder;
            document.getElementById('form-button-text').textContent = 'تحديث المهمة';
            document.getElementById('cancel-edit-btn').style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
            taskTitleInput.focus();
        }
        window.handleDelete = function(id) {
            taskToDeleteId = id;
            deleteModal.show();
        }
        window.markAsComplete = function(id) {
            const taskIndex = tasks.findIndex(t => t.id === id);
            if (taskIndex > -1 && tasks[taskIndex].status !== 'completed') {
                tasks[taskIndex].status = 'completed';
                stopCountdown(id, false);
                playSound('complete');
                saveTasks();
                renderTasks();
            }
        }

        function formatTime(seconds) {
            const m = Math.floor(seconds / 60).toString().padStart(2, '0');
            const s = (seconds % 60).toString().padStart(2, '0');
            return `${m}:${s}`;
        }
        
        function formatLongTime(seconds) {
            if (seconds < 0) seconds = 0;
            const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
            const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
            const s = Math.floor(seconds % 60).toString().padStart(2, '0');
            return `${h}:${m}:${s}`;
        }

        function startTaskTimerLoop(id, endTime) {
            const timerElement = document.getElementById(`timer-${id}`);
            if (!timerElement) return;

            activeTimers[id] = setInterval(() => {
                const remainingSeconds = Math.round((endTime - Date.now()) / 1000);
                if (remainingSeconds > 0) {
                    timerElement.textContent = formatLongTime(remainingSeconds);
                } else {
                    timerElement.textContent = "انتهى الوقت!";
                    markAsComplete(id);
                    showToast("انتهى الوقت", `انتهى وقت المهمة.`, "warning");
                }
            }, 1000);
        }
        
        window.startCountdown = function(id) {
            const taskIndex = tasks.findIndex(t => t.id === id);
            if (taskIndex === -1 || tasks[taskIndex].status === 'completed' || activeTimers[id]) return;
            
            const task = tasks[taskIndex];
            task.status = 'in-progress';
            task.countdownEndTime = Date.now() + (task.remainingTime * 1000);
            
            saveTasks();
            renderTasks();
            startTaskTimerLoop(id, task.countdownEndTime);
        }

        window.stopCountdown = function(id, changeStatus = true) {
            if (activeTimers[id]) {
                clearInterval(activeTimers[id]);
                delete activeTimers[id];
            }
            const taskIndex = tasks.findIndex(t => t.id === id);
            if (taskIndex > -1) {
                const task = tasks[taskIndex];
                if (task.countdownEndTime) {
                    task.remainingTime = Math.round((task.countdownEndTime - Date.now()) / 1000);
                    if (task.remainingTime < 0) task.remainingTime = 0;
                }
                task.countdownEndTime = null;
                if (changeStatus) {
                    task.status = 'pending';
                }
                saveTasks();
                renderTasks();
            }
        }

        function updatePomodoroDisplay() {
            const remainingSeconds = pomodoroState === 'running' ? Math.round((pomodoroEndTime - Date.now()) / 1000) : pomodoroTimeLeft;
            const displaySeconds = remainingSeconds > 0 ? remainingSeconds : 0;
            pomodoroDisplay.textContent = formatTime(displaySeconds);
            document.title = pomodoroState === 'running' ? `${formatTime(displaySeconds)} - قائمة المهام` : 'قائمة المهام';
        }

        function handlePomodoroStartPause() {
            startAudio();
            const icon = pomodoroStartPauseBtn.querySelector('i');
            const text = pomodoroStartPauseBtn.querySelector('span');

            if (pomodoroState === 'stopped' || pomodoroState === 'paused') {
                pomodoroEndTime = Date.now() + pomodoroTimeLeft * 1000;
                pomodoroState = 'running';
                icon.className = 'fas fa-pause';
                text.textContent = 'إيقاف';
                pomodoroInterval = setInterval(() => {
                    const remaining = Math.round((pomodoroEndTime - Date.now()) / 1000);
                    if (remaining <= 0) {
                        clearInterval(pomodoroInterval);
                        playSound('pomodoroEnd');
                        const modeTextMap = { pomodoro: 'التركيز', short: 'الراحة القصيرة', long: 'الراحة الطويلة' };
                        showToast("انتهى الوقت!", `انتهت جلسة ${modeTextMap[pomodoroMode]}.`, "success");
                        switchPomodoroMode(pomodoroMode === 'pomodoro' ? 'short' : 'pomodoro');
                    } else {
                        updatePomodoroDisplay();
                    }
                }, 1000);
            } else if (pomodoroState === 'running') {
                clearInterval(pomodoroInterval);
                pomodoroTimeLeft = Math.round((pomodoroEndTime - Date.now()) / 1000);
                pomodoroState = 'paused';
                icon.className = 'fas fa-play';
                text.textContent = 'متابعة';
            }
            updatePomodoroDisplay();
        }

        function resetPomodoro() {
            clearInterval(pomodoroInterval);
            pomodoroState = 'stopped';
            pomodoroTimeLeft = pomodoroSettings[pomodoroMode] * 60;
            pomodoroEndTime = 0;
            updatePomodoroDisplay();
            pomodoroStartPauseBtn.querySelector('i').className = 'fas fa-play';
            pomodoroStartPauseBtn.querySelector('span').textContent = 'بدء';
        }

        function switchPomodoroMode(newMode) {
            pomodoroMode = newMode;
            Object.values(pomodoroModeBtns).forEach(btn => btn.classList.remove('active'));
            pomodoroModeBtns[newMode].classList.add('active');
            resetPomodoro();
        }

        function requestNotificationPermission() {
            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission();
            }
        }
        function scheduleNotification(task) {
            if (!task.reminder || !('Notification' in window) || Notification.permission !== 'granted') return;
            const delay = new Date(task.endDate).getTime() - (task.reminder * 60 * 1000) - Date.now();
            if (delay > 0) {
                setTimeout(() => {
                    const currentTask = tasks.find(t => t.id === task.id);
                    if (currentTask && currentTask.status !== 'completed') {
                        playSound('reminder');
                        new Notification('تذكير بمهمة قادمة', {
                            body: `مهمة "${task.title}" على وشك الانتهاء خلال ${task.reminder} دقيقة.`
                        });
                    }
                }, delay);
            }
        }
        
        function scheduleStartAlert(task) {
            const delay = new Date(task.startDate).getTime() - Date.now() - (1 * 60 * 1000);
            if (delay > 0) {
                setTimeout(() => {
                    const currentTask = tasks.find(t => t.id === task.id);
                    if (currentTask && currentTask.status === 'pending') {
                        playSound('startAlert');
                        document.getElementById('taskStartAlertName').textContent = currentTask.title;
                        taskStartAlertModal.show();
                    }
                }, delay);
            }
        }
        
        function showToast(title, body, type = 'info') {
            const toastTitle = document.getElementById('toast-title');
            const toastBody = document.getElementById('toast-body');
            const toastHeader = document.querySelector('#app-toast .toast-header');
            toastTitle.textContent = title;
            toastBody.textContent = body;
            toastHeader.className = 'toast-header';
            const bgClass = { success: 'bg-success', danger: 'bg-danger', warning: 'bg-warning', info: 'bg-info' }[type];
            if (bgClass) toastHeader.classList.add(bgClass, 'text-white');
            appToast.show();
        }

        function toggleFullScreen() {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
        }

        function handleFullScreenChange() {
            if (!document.fullscreenElement) {
                navBar.classList.remove('hidden');
            } else {
                navBar.classList.add('hidden');
            }
        }

        async function callGemini(prompt, buttonElement) {
            if (buttonElement) buttonElement.disabled = true;
            
            const apiKey = "AIzaSyAwR2RKbZmG4q0ZJB3vqtossMFc4UE2mQ0"; 
            
            if (apiKey === "" || apiKey === "YOUR_API_KEY") {
                showToast("خطأ في الإعداد", "الرجاء إدخال مفتاح API الخاص بك في الكود.", "danger");
                if (buttonElement) buttonElement.disabled = false;
                return null;
            }

            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
            const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!response.ok) throw new Error(`API request failed with status: ${response.status}`);
                const result = await response.json();
                return result.candidates?.[0]?.content?.parts?.[0]?.text;
            } catch (error) {
                console.error("Error calling API:", error);
                if (error.message.includes("403")) {
                    showToast("خطأ 403: الوصول مرفوض", "المفتاح غير مصرح له بالعمل من هذا الموقع. يرجى مراجعة قيود الموقع.", "danger");
                } else {
                    showToast("خطأ في الاتصال", "لا يمكن الوصول إلى الخدمة حاليًا. تأكد من صحة مفتاح API والاتصال بالإنترنت.", "danger");
                }
                return null;
            } finally {
                if (buttonElement) buttonElement.disabled = false;
            }
        }

        async function fetchAIQuote() {
            const quoteBtn = document.getElementById('gemini-quote-btn');
            const prompt = "اكتب اقتباسًا أو حكمة قصيرة من أقوال علماء الإسلام الكبار مثل: ابن القيم، ابن تيمية، الإمام مالك، الإمام أحمد بن حنبل، الإمام الشافعي، الإمام أبو حنيفة، النووي، أبو إسحاق الحويني، مصطفى العدوي، محمد حسان، عبد السلام الشويعر، وليد السعيدان، صالح الفوزان، سمير مصطفى، علي طنطاوي، أو غيرهم من العلماء الموثوقين. يجب أن يكون الاقتباس عن العمل، أو إدارة الوقت، أو السعي، أو الأخلاق. أرجع الاقتباس واسم القائل مفصولين بـ ' - '. مثال: 'الوقت سيف، إن لم تقطعه قطعك - الإمام الشافعي'. لا تضف أي نص آخر.";
            if (document.getElementById('quote-text').textContent === 'يتم الآن تحميل حكمة ملهمة...') {
                document.getElementById('quote-text').textContent = 'جاري توليد حكمة...';
                document.getElementById('quote-author').textContent = '...';
            }
            const resultText = await callGemini(prompt, quoteBtn);
            if (resultText) {
                const parts = resultText.trim().split(' - ');
                let quote = resultText.trim();
                let author = "من حكم السلف الصالح";
                if (parts.length >= 2) {
                    quote = parts.slice(0, -1).join(' - ').trim();
                    author = parts[parts.length - 1].trim();
                }
                if (quote.startsWith('"') && quote.endsWith('"')) {
                    quote = quote.substring(1, quote.length - 1);
                }
                document.getElementById('quote-text').textContent = quote;
                document.getElementById('quote-author').textContent = author;
            }
        }

        async function handleTaskBreakdown() {
            const titleInput = document.getElementById('task-title');
            const taskTitle = titleInput.value.trim();
            if (taskTitle.length < 10) {
                showToast("خطأ", "يرجى كتابة عنوان مهمة وصفي أكثر.", "warning");
                return;
            }
            const breakdownBtn = document.getElementById('gemini-breakdown-btn');
            const prompt = `قسّم المهمة التالية إلى قائمة من المهام الفرعية البسيطة والقابلة للتنفيذ. أرجع قائمة فقط، كل مهمة في سطر جديد، بدون ترقيم أو علامات خاصة. المهمة هي: "${taskTitle}"`;
            const result = await callGemini(prompt, breakdownBtn);
            if (result) {
                const subTasks = result.trim().split('\n').filter(line => line.trim() !== '');
                if (subTasks.length > 0) {
                    const now = new Date();
                    const defaultStartDate = document.getElementById('task-start').value || now.toISOString().slice(0, 16);
                    const defaultEndDate = document.getElementById('task-end').value || new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 16);
                    subTasks.forEach(subTaskTitle => {
                        tasks.push({
                            title: subTaskTitle,
                            description: `مهمة فرعية من: "${taskTitle}"`,
                            priority: document.querySelector('input[name="priority"]:checked').value,
                            startDate: defaultStartDate,
                            endDate: defaultEndDate,
                            reminder: null,
                            id: 'task-' + Date.now() + Math.random(),
                            status: 'pending',
                            createdAt: new Date().toISOString(),
                            remainingTime: (new Date(defaultEndDate) - new Date(defaultStartDate)) / 1000,
                        });
                    });
                    saveTasks();
                    renderTasks();
                    titleInput.value = '';
                    breakdownBtn.style.display = 'none';
                    showToast("✨ نجاح", `تمت إضافة ${subTasks.length} مهمة فرعية.`, "success");
                } else {
                    showToast("لم يتم التعرف على مهام", "لم نتمكن من تقسيم هذه المهمة.", "info");
                }
            }
        }

        function setupEventListeners() {
            taskForm.addEventListener('submit', handleFormSubmit);
            primaryColorPicker.addEventListener('input', (e) => applyColors(e.target.value, secondaryColorPicker.value));
            secondaryColorPicker.addEventListener('input', (e) => applyColors(primaryColorPicker.value, e.target.value));
            document.querySelectorAll('input[name="filter"]').forEach(radio => radio.addEventListener('change', (e) => {
                currentFilter = e.target.id.replace('filter-', '');
                renderTasks();
            }));
            document.getElementById('sort-tasks').addEventListener('change', (e) => {
                currentSort = e.target.value;
                renderTasks();
            });
            document.getElementById('gemini-quote-btn').addEventListener('click', fetchAIQuote);
            document.getElementById('gemini-breakdown-btn').addEventListener('click', handleTaskBreakdown);
            document.getElementById('task-title').addEventListener('input', (e) => {
                document.getElementById('gemini-breakdown-btn').style.display = e.target.value.trim().length >= 10 ? 'block' : 'none';
            });
            document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
                if (taskToDeleteId) {
                    tasks = tasks.filter(t => t.id !== taskToDeleteId);
                    stopCountdown(taskToDeleteId, false);
                    saveTasks();
                    renderTasks();
                    showToast("تم الحذف", "تم حذف المهمة.", "info");
                    taskToDeleteId = null;
                    deleteModal.hide();
                }
            });
            pomodoroStartPauseBtn.addEventListener('click', handlePomodoroStartPause);
            pomodoroResetBtn.addEventListener('click', resetPomodoro);
            Object.keys(pomodoroModeBtns).forEach(mode => pomodoroModeBtns[mode].addEventListener('click', () => switchPomodoroMode(mode)));
            document.getElementById('savePomodoroSettingsBtn').addEventListener('click', savePomodoroSettings);
            document.getElementById('cancel-edit-btn').addEventListener('click', cancelEdit);
            document.addEventListener('dblclick', toggleFullScreen);
            document.addEventListener('fullscreenchange', handleFullScreenChange);
        }

        initializeApp();
    });
