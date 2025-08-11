// --- Main Application JavaScript (ES6+) ---

document.addEventListener("DOMContentLoaded", () => {
  // --- 1. STATE MANAGEMENT & VARIABLES ---

  let tasks = [];
  let activeTimers = {};
  let currentFilter = "all";
  let currentSort = "time-asc";
  let taskToDeleteId = null;

  // Pomodoro State
  let pomodoroState = "stopped"; // 'stopped', 'running', 'paused'
  let pomodoroMode = "pomodoro"; // 'pomodoro', 'short', 'long'
  const pomodoroTimes = {
    pomodoro: 25 * 60,
    short: 5 * 60,
    long: 15 * 60,
  };
  let pomodoroTimeLeft = pomodoroTimes.pomodoro;
  let pomodoroInterval = null;

  // DOM Element & Bootstrap Component References
  const taskForm = document.getElementById("task-form");
  const taskListContainer = document.getElementById("task-list-container");
  const primaryColorPicker = document.getElementById("primaryColorPicker");
  const secondaryColorPicker = document.getElementById("secondaryColorPicker");
  const appToast = new bootstrap.Toast(document.getElementById("app-toast"));
  const deleteModal = new bootstrap.Modal(
    document.getElementById("deleteConfirmModal")
  );

  // Pomodoro DOM References
  const pomodoroDisplay = document.getElementById("pomodoro-timer");
  const pomodoroStartPauseBtn = document.getElementById("pomodoro-start-pause");
  const pomodoroResetBtn = document.getElementById("pomodoro-reset");
  const pomodoroModeBtns = {
    pomodoro: document.getElementById("pomodoro-mode-pomodoro"),
    short: document.getElementById("pomodoro-mode-short"),
    long: document.getElementById("pomodoro-mode-long"),
  };

  // --- 2. INITIALIZATION ---

  function initializeApp() {
    loadTheme();
    loadColors();
    loadTasks();
    fetchAIQuote(); // Fetch initial quote from AI
    setupEventListeners();
    requestNotificationPermission();
    renderTasks();
    switchPomodoroMode("pomodoro"); // Initialize Pomodoro display
  }

  // --- 3. THEME & COLOR MANAGEMENT ---

  function loadTheme() {
    const savedTheme = localStorage.getItem("appTheme") || "light";
    setTheme(savedTheme);
  }

  function loadColors() {
    const primary = localStorage.getItem("primaryColor") || "#0d6efd";
    const secondary = localStorage.getItem("secondaryColor") || "#6c757d";
    primaryColorPicker.value = primary;
    secondaryColorPicker.value = secondary;
    applyColors(primary, secondary);
  }

  window.setTheme = function (theme) {
    document.documentElement.setAttribute("data-bs-theme", theme);
    localStorage.setItem("appTheme", theme);
  };

  function applyColors(primary, secondary) {
    document.documentElement.style.setProperty("--custom-primary", primary);
    document.documentElement.style.setProperty("--custom-secondary", secondary);
    localStorage.setItem("primaryColor", primary);
    localStorage.setItem("secondaryColor", secondary);
  }

  // --- 4. DATA HANDLING ---

  function saveTasks() {
    localStorage.setItem("tasks", JSON.stringify(tasks));
  }

  function loadTasks() {
    tasks = JSON.parse(localStorage.getItem("tasks")) || [];
    tasks.forEach((task) => {
      if (task.status === "in-progress" && task.remainingTime > 0) {
        startCountdown(task.id);
      }
    });
  }

  // --- 5. TASK RENDERING ---

  function renderTasks() {
    taskListContainer.innerHTML = "";

    let filteredTasks = tasks.filter((task) => {
      if (currentFilter === "all") return true;
      return task.status === currentFilter;
    });

    filteredTasks.sort((a, b) => {
      switch (currentSort) {
        case "priority":
          const priorityMap = { high: 3, medium: 2, low: 1 };
          return (
            (priorityMap[b.priority] || 0) - (priorityMap[a.priority] || 0)
          );
        case "time-desc":
          return new Date(a.createdAt) - new Date(b.createdAt);
        case "time-asc":
        default:
          return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });

    if (filteredTasks.length === 0) {
      taskListContainer.innerHTML = `<div class="text-center p-5 bg-body-secondary rounded">
                    <i class="fas fa-folder-open fa-3x text-secondary mb-3"></i>
                    <p class="h5">لا توجد مهام لعرضها.</p>
                    <p>جرّب إضافة مهمة جديدة أو تغيير الفلتر.</p>
                </div>`;
      return;
    }

    filteredTasks.forEach((task) => {
      const taskCard = createTaskCard(task);
      taskListContainer.appendChild(taskCard);
    });
  }

  function createTaskCard(task) {
    const card = document.createElement("div");
    card.className = `card task-card mb-3 shadow-sm status-${task.status} priority-${task.priority}`;
    card.dataset.id = task.id;

    const priorityText = { high: "عالية", medium: "متوسطة", low: "منخفضة" };
    const statusText = {
      pending: "قادمة",
      "in-progress": "جارية",
      completed: "مكتملة",
    };
    const statusIcon = {
      pending: "fa-hourglass-start",
      "in-progress": "fa-person-running",
      completed: "fa-check-circle",
    };
    const statusColor = {
      pending: "text-secondary",
      "in-progress": "text-primary",
      completed: "text-success",
    };

    const now = new Date();
    const endDate = new Date(task.endDate);
    const isOverdue = now > endDate && task.status !== "completed";

    let timerHTML = "";
    if (task.status === "in-progress") {
      timerHTML = `<span class="countdown-timer ms-2" id="timer-${task.id}">--:--:--</span>`;
    }

    card.innerHTML = `
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h5 class="card-title task-title mb-1">${
                              task.title
                            }</h5>
                            <p class="card-text text-muted small">${
                              task.description || ""
                            }</p>
                        </div>
                        <div class="dropdown">
                            <button class="btn btn-sm btn-link text-secondary" type="button" data-bs-toggle="dropdown">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="#" onclick="handleEdit('${
                                  task.id
                                }')"><i class="fas fa-edit fa-fw me-2"></i>تعديل</a></li>
                                <li><a class="dropdown-item" href="#" onclick="markAsComplete('${
                                  task.id
                                }')"><i class="fas fa-check fa-fw me-2"></i>إكمال المهمة</a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item text-danger" href="#" onclick="handleDelete('${
                                  task.id
                                }')"><i class="fas fa-trash fa-fw me-2"></i>حذف</a></li>
                            </ul>
                        </div>
                    </div>
                    <hr>
                    <div class="d-flex flex-wrap justify-content-between align-items-center small text-muted">
                        <span class="mb-2 mb-md-0"><i class="fas fa-flag fa-fw me-1"></i><strong>الأولوية:</strong> ${
                          priorityText[task.priority]
                        }</span>
                        <span class="mb-2 mb-md-0 ${
                          statusColor[task.status]
                        }"><i class="fas ${
      statusIcon[task.status]
    } fa-fw me-1"></i><strong>الحالة:</strong> ${statusText[task.status]}</span>
                        <span class="mb-2 mb-md-0 ${
                          isOverdue ? "text-danger fw-bold" : ""
                        }"><i class="fas fa-calendar-times fa-fw me-1"></i><strong>تنتهي في:</strong> ${new Date(
      task.endDate
    ).toLocaleString("ar-EG")}</span>
                    </div>
                    <div class="mt-3 d-flex justify-content-between align-items-center">
                        <div>
                            ${getControlButton(task)}
                        </div>
                        ${timerHTML}
                    </div>
                </div>
            `;
    return card;
  }

  function getControlButton(task) {
    switch (task.status) {
      case "pending":
        return `<button class="btn btn-sm btn-primary" onclick="startCountdown('${task.id}')"><i class="fas fa-play"></i> بدء</button>`;
      case "in-progress":
        return `<button class="btn btn-sm btn-warning" onclick="stopCountdown('${task.id}')"><i class="fas fa-pause"></i> إيقاف مؤقت</button>`;
      case "completed":
        return `<span class="text-success fw-bold"><i class="fas fa-check"></i> مكتملة</span>`;
      default:
        return "";
    }
  }

  // --- 6. TASK ACTIONS (CRUD) ---

  function handleFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("task-id").value;
    const title = document.getElementById("task-title").value.trim();
    const start = document.getElementById("task-start").value;
    const end = document.getElementById("task-end").value;

    if (new Date(end) <= new Date(start)) {
      showToast("خطأ", "وقت الانتهاء يجب أن يكون بعد وقت البدء.", "danger");
      return;
    }

    const taskData = {
      title: title,
      description: document.getElementById("task-desc").value.trim(),
      priority: document.getElementById("task-priority").value,
      startDate: start,
      endDate: end,
      reminder:
        parseInt(document.getElementById("task-reminder").value) || null,
    };

    if (id) {
      const taskIndex = tasks.findIndex((t) => t.id === id);
      if (taskIndex > -1) {
        tasks[taskIndex] = { ...tasks[taskIndex], ...taskData };
        showToast("نجاح", "تم تحديث المهمة بنجاح.", "success");
      }
    } else {
      const newTask = {
        ...taskData,
        id: "task-" + Date.now(),
        status: "pending",
        createdAt: new Date().toISOString(),
        remainingTime: (new Date(end) - new Date(start)) / 1000,
      };
      tasks.push(newTask);
      scheduleNotification(newTask);
      showToast("نجاح", "تمت إضافة المهمة بنجاح.", "success");
    }

    saveTasks();
    renderTasks();
    taskForm.reset();
    document.getElementById("task-id").value = "";
    document.getElementById("form-button-text").textContent = "إضافة المهمة";
    document.getElementById("gemini-breakdown-btn").style.display = "none";
  }

  window.handleEdit = function (id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    document.getElementById("task-id").value = task.id;
    document.getElementById("task-title").value = task.title;
    document.getElementById("task-desc").value = task.description;
    document.getElementById("task-priority").value = task.priority;
    document.getElementById("task-start").value = task.startDate;
    document.getElementById("task-end").value = task.endDate;
    document.getElementById("task-reminder").value = task.reminder;
    document.getElementById("form-button-text").textContent = "تحديث المهمة";
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  window.handleDelete = function (id) {
    taskToDeleteId = id;
    deleteModal.show();
  };

  window.markAsComplete = function (id) {
    const taskIndex = tasks.findIndex((t) => t.id === id);
    if (taskIndex > -1 && tasks[taskIndex].status !== "completed") {
      tasks[taskIndex].status = "completed";
      stopCountdown(id, false);
      saveTasks();
      renderTasks();
    }
  };

  // --- 7. COUNTDOWN TIMER LOGIC ---

  function formatTime(seconds) {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600)
      .toString()
      .padStart(2, "0");
    const m = Math.floor((seconds % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return `${h}:${m}:${s}`;
  }

  window.startCountdown = function (id) {
    const taskIndex = tasks.findIndex((t) => t.id === id);
    if (taskIndex === -1 || tasks[taskIndex].status === "completed") return;
    if (activeTimers[id]) return;

    tasks[taskIndex].status = "in-progress";
    saveTasks();
    renderTasks();

    const timerElement = document.getElementById(`timer-${id}`);
    if (!timerElement) return;

    activeTimers[id] = setInterval(() => {
      const currentTask = tasks[taskIndex];
      if (currentTask.remainingTime > 0) {
        currentTask.remainingTime--;
        timerElement.textContent = formatTime(currentTask.remainingTime);
        if (currentTask.remainingTime % 5 === 0) saveTasks();
      } else {
        timerElement.textContent = "انتهى الوقت!";
        markAsComplete(id);
        showToast(
          "انتهى الوقت",
          `انتهى وقت المهمة: "${currentTask.title}"`,
          "warning"
        );
      }
    }, 1000);
  };

  window.stopCountdown = function (id, changeStatus = true) {
    if (activeTimers[id]) {
      clearInterval(activeTimers[id]);
      delete activeTimers[id];
    }
    if (changeStatus) {
      const taskIndex = tasks.findIndex((t) => t.id === id);
      if (taskIndex > -1) {
        tasks[taskIndex].status = "pending";
        saveTasks();
        renderTasks();
      }
    }
  };

  // --- 8. POMODORO TIMER LOGIC ---

  function updatePomodoroDisplay() {
    const minutes = Math.floor(pomodoroTimeLeft / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (pomodoroTimeLeft % 60).toString().padStart(2, "0");
    pomodoroDisplay.textContent = `${minutes}:${seconds}`;
    if (pomodoroState === "running") {
      document.title = `${minutes}:${seconds} - قائمة المهام الذكية`;
    } else {
      document.title = "قائمة المهام الذكية";
    }
  }

  function handlePomodoroStartPause() {
    const startPauseIcon = pomodoroStartPauseBtn.querySelector("i");
    const startPauseText = pomodoroStartPauseBtn.querySelector("span");

    if (pomodoroState === "stopped" || pomodoroState === "paused") {
      pomodoroState = "running";
      startPauseIcon.className = "fas fa-pause";
      startPauseText.textContent = "إيقاف";
      pomodoroInterval = setInterval(() => {
        pomodoroTimeLeft--;
        updatePomodoroDisplay();
        if (pomodoroTimeLeft <= 0) {
          clearInterval(pomodoroInterval);
          const modeText =
            pomodoroMode === "pomodoro"
              ? "التركيز"
              : pomodoroMode === "short"
              ? "الراحة القصيرة"
              : "الراحة الطويلة";
          showToast("انتهى الوقت!", `انتهت جلسة ${modeText}.`, "success");

          if (pomodoroMode === "pomodoro") {
            switchPomodoroMode("short");
          } else {
            switchPomodoroMode("pomodoro");
          }
        }
      }, 1000);
    } else if (pomodoroState === "running") {
      pomodoroState = "paused";
      startPauseIcon.className = "fas fa-play";
      startPauseText.textContent = "متابعة";
      clearInterval(pomodoroInterval);
    }
  }

  function resetPomodoro() {
    clearInterval(pomodoroInterval);
    pomodoroState = "stopped";
    pomodoroTimeLeft = pomodoroTimes[pomodoroMode];
    updatePomodoroDisplay();
    pomodoroStartPauseBtn.querySelector("i").className = "fas fa-play";
    pomodoroStartPauseBtn.querySelector("span").textContent = "بدء";
  }

  function switchPomodoroMode(newMode) {
    pomodoroMode = newMode;
    Object.values(pomodoroModeBtns).forEach((btn) =>
      btn.classList.remove("active")
    );
    pomodoroModeBtns[newMode].classList.add("active");
    resetPomodoro();
  }

  // --- 9. NOTIFICATIONS ---

  function requestNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }

  function scheduleNotification(task) {
    if (
      !task.reminder ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    )
      return;

    const reminderTime =
      new Date(task.endDate).getTime() - task.reminder * 60 * 1000;
    const delay = reminderTime - Date.now();

    if (delay > 0) {
      setTimeout(() => {
        const currentTask = tasks.find((t) => t.id === task.id);
        if (currentTask && currentTask.status !== "completed") {
          new Notification("تذكير بمهمة قادمة", {
            body: `مهمة "${task.title}" على وشك الانتهاء خلال ${task.reminder} دقيقة.`,
            icon: "https://img.icons8.com/color/48/000000/appointment-reminders.png",
          });
        }
      }, delay);
    }
  }

  // --- 10. UTILITY FUNCTIONS ---

  function showToast(title, body, type = "info") {
    const toastTitle = document.getElementById("toast-title");
    const toastBody = document.getElementById("toast-body");
    const toastHeader = document.querySelector("#app-toast .toast-header");

    toastTitle.textContent = title;
    toastBody.textContent = body;

    toastHeader.className = "toast-header"; // Reset classes
    const bgClass = {
      success: "bg-success",
      danger: "bg-danger",
      warning: "bg-warning",
      info: "bg-info",
    }[type];
    if (bgClass) toastHeader.classList.add(bgClass, "text-white");

    appToast.show();
  }

  // --- 11. GEMINI API INTEGRATION ---

  async function callGemini(prompt, buttonElement) {
    if (buttonElement) buttonElement.disabled = true;

    const apiKey = "AIzaSyAwR2RKbZmG4q0ZJB3vqtossMFc4UE2mQ0"; // Provided by environment
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
    const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };

    let retries = 3;
    let delay = 1000;

    while (retries > 0) {
      try {
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
            if (buttonElement) buttonElement.disabled = false;
            return result.candidates[0].content.parts[0].text;
          } else {
            throw new Error("Invalid response structure from Gemini API.");
          }
        } else if (response.status === 429 || response.status >= 500) {
          throw new Error(`API request failed with status: ${response.status}`);
        } else {
          retries = 0;
          throw new Error(`API request failed with status: ${response.status}`);
        }
      } catch (error) {
        retries--;
        if (retries > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        } else {
          console.error("Error calling Gemini API:", error);
          showToast(
            "خطأ في الاتصال",
            "لا يمكن الوصول إلى خدمة الذكاء الاصطناعي حاليًا.",
            "danger"
          );
          if (buttonElement) buttonElement.disabled = false;
          return null;
        }
      }
    }
    if (buttonElement) buttonElement.disabled = false;
    return null;
  }

  async function fetchAIQuote() {
    const quoteBtn = document.getElementById("gemini-quote-btn");
    const prompt =
      "اكتب اقتباسًا أو حكمة قصيرة من أقوال علماء الإسلام الكبار مثل: ابن القيم، ابن تيمية، الإمام مالك، الإمام أحمد بن حنبل، الإمام الشافعي، الإمام أبو حنيفة، النووي، أبو إسحاق الحويني، مصطفى العدوي، محمد حسان، عبد السلام الشويعر، وليد السعيدان، صالح الفوزان، سمير مصطفى، علي طنطاوي، أو غيرهم من العلماء الموثوقين. يجب أن يكون الاقتباس عن العمل، أو إدارة الوقت، أو السعي، أو الأخلاق. أرجع الاقتباس واسم القائل مفصولين بـ ' - '. مثال: 'الوقت سيف، إن لم تقطعه قطعك - الإمام الشافعي'. لا تضف أي نص آخر.";

    // On initial load, show a loading message. On subsequent clicks, the old quote remains.
    if (
      document.getElementById("quote-text").textContent ===
      "يتم الآن تحميل حكمة ملهمة..."
    ) {
      document.getElementById("quote-text").textContent = "جاري توليد حكمة...";
      document.getElementById("quote-author").textContent = "...";
    }

    const resultText = await callGemini(prompt, quoteBtn);

    if (resultText) {
      const parts = resultText.trim().split(" - ");
      let quote = resultText.trim();
      let author = "من حكم السلف الصالح";

      // Check if the response is in the expected format "Quote - Author"
      if (parts.length >= 2) {
        // Re-join in case the quote itself contained a hyphen.
        quote = parts.slice(0, -1).join(" - ").trim();
        author = parts[parts.length - 1].trim();
      }

      // Remove potential quotation marks from the start and end of the quote
      if (quote.startsWith('"') && quote.endsWith('"')) {
        quote = quote.substring(1, quote.length - 1);
      }

      document.getElementById("quote-text").textContent = quote;
      document.getElementById("quote-author").textContent = author;
    }
    // If the call fails, the old quote remains visible. The toast from callGemini provides the error feedback.
  }

  async function handleTaskBreakdown() {
    const titleInput = document.getElementById("task-title");
    const taskTitle = titleInput.value.trim();
    if (taskTitle.length < 10) {
      showToast("خطأ", "يرجى كتابة عنوان مهمة وصفي أكثر.", "warning");
      return;
    }

    const breakdownBtn = document.getElementById("gemini-breakdown-btn");
    const prompt = `قسّم المهمة التالية إلى قائمة من المهام الفرعية البسيطة والقابلة للتنفيذ. أرجع قائمة فقط، كل مهمة في سطر جديد، بدون ترقيم أو علامات خاصة. المهمة هي: "${taskTitle}"`;

    const result = await callGemini(prompt, breakdownBtn);

    if (result) {
      const subTasks = result
        .trim()
        .split("\n")
        .filter((line) => line.trim() !== "");

      if (subTasks.length > 0) {
        const now = new Date();
        const defaultStartDate =
          document.getElementById("task-start").value ||
          now.toISOString().slice(0, 16);
        const defaultEndDate =
          document.getElementById("task-end").value ||
          new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 16);

        subTasks.forEach((subTaskTitle) => {
          const newTask = {
            title: subTaskTitle,
            description: `مهمة فرعية من: "${taskTitle}"`,
            priority: document.getElementById("task-priority").value,
            startDate: defaultStartDate,
            endDate: defaultEndDate,
            reminder: null,
            id: "task-" + Date.now() + Math.random(),
            status: "pending",
            createdAt: new Date().toISOString(),
            remainingTime:
              (new Date(defaultEndDate) - new Date(defaultStartDate)) / 1000,
          };
          tasks.push(newTask);
        });

        saveTasks();
        renderTasks();
        titleInput.value = "";
        breakdownBtn.style.display = "none";
        showToast(
          "✨ نجاح",
          `تمت إضافة ${subTasks.length} مهمة فرعية.`,
          "success"
        );
      } else {
        showToast(
          "لم يتم التعرف على مهام",
          "لم يتمكن الذكاء الاصطناعي من تقسيم هذه المهمة.",
          "info"
        );
      }
    }
  }

  // --- 12. EVENT LISTENERS ---

  function setupEventListeners() {
    taskForm.addEventListener("submit", handleFormSubmit);

    primaryColorPicker.addEventListener("input", (e) =>
      applyColors(e.target.value, secondaryColorPicker.value)
    );
    secondaryColorPicker.addEventListener("input", (e) =>
      applyColors(primaryColorPicker.value, e.target.value)
    );

    document.querySelectorAll('input[name="filter"]').forEach((radio) => {
      radio.addEventListener("change", (e) => {
        currentFilter = e.target.id.replace("filter-", "");
        renderTasks();
      });
    });

    document.getElementById("sort-tasks").addEventListener("change", (e) => {
      currentSort = e.target.value;
      renderTasks();
    });

    // Gemini Listeners
    document
      .getElementById("gemini-quote-btn")
      .addEventListener("click", fetchAIQuote);
    document
      .getElementById("gemini-breakdown-btn")
      .addEventListener("click", handleTaskBreakdown);

    document.getElementById("task-title").addEventListener("input", (e) => {
      const breakdownBtn = document.getElementById("gemini-breakdown-btn");
      breakdownBtn.style.display =
        e.target.value.trim().length >= 10 ? "block" : "none";
    });

    // Delete confirmation listener
    document
      .getElementById("confirmDeleteBtn")
      .addEventListener("click", () => {
        if (taskToDeleteId) {
          tasks = tasks.filter((t) => t.id !== taskToDeleteId);
          stopCountdown(taskToDeleteId, false);
          saveTasks();
          renderTasks();
          showToast("تم الحذف", "تم حذف المهمة.", "info");
          taskToDeleteId = null;
          deleteModal.hide();
        }
      });

    // Pomodoro Listeners
    pomodoroStartPauseBtn.addEventListener("click", handlePomodoroStartPause);
    pomodoroResetBtn.addEventListener("click", resetPomodoro);
    Object.keys(pomodoroModeBtns).forEach((mode) => {
      pomodoroModeBtns[mode].addEventListener("click", () =>
        switchPomodoroMode(mode)
      );
    });
  }

  // --- KICKSTART THE APP ---
  initializeApp();
});
