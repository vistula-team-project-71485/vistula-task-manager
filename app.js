let supabaseUrl;
let supabaseKey;
let tableName;

let editingTaskId = null;

const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const descriptionInput = document.getElementById("task-description");
const taskList = document.getElementById("task-list");
const taskCount = document.getElementById("task-count");
const statusMessage = document.getElementById("status-message");
const submitButton = document.getElementById("task-submit");
const cancelButton = document.getElementById("cancel-edit");

function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.style.color = isError ? "#dc2626" : "#15803d";
}

function getHeaders(extraHeaders = {}) {
    return {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        ...extraHeaders
    };
}

function getTasksUrl() {
    return `${supabaseUrl}/rest/v1/${tableName}`;
}

async function loadTasks() {
    try {
        const response = await fetch(
            `${getTasksUrl()}?select=*&order=id.asc`,
            { headers: getHeaders() }
        );

        if (!response.ok) {
            throw new Error(await response.text());
        }

        const tasks = await response.json();
        renderTasks(tasks);
        showStatus("Tasks loaded successfully.");
    } catch (error) {
        showStatus("Could not load tasks: " + error.message, true);
    }
}

function renderTasks(tasks) {
    taskList.replaceChildren();
    taskCount.textContent = tasks.length;

    if (tasks.length === 0) {
        const emptyMessage = document.createElement("p");
        emptyMessage.textContent = "No tasks yet. Add your first task!";
        taskList.appendChild(emptyMessage);
        return;
    }

    tasks.forEach(task => {
        const item = document.createElement("div");
        item.className = "task-item";
        item.dataset.id = task.id;

        const content = document.createElement("div");

        const title = document.createElement("h3");
        title.className = "task-title";
        title.textContent = task.title;

        const description = document.createElement("p");
        description.className = "task-description";
        description.textContent = task.description || "";

        const status = document.createElement("p");
        status.className = "task-status";
        status.textContent = task.completed ? "Completed" : "Not completed";

        if (task.completed) {
            item.classList.add("completed");
        }

        content.append(title, description, status);

        const actions = document.createElement("div");
        actions.className = "task-actions";

        const toggleButton = document.createElement("button");
        toggleButton.className = "toggle-task";
        toggleButton.textContent = task.completed
            ? "Mark as not completed"
            : "Mark as completed";
        toggleButton.addEventListener("click", () => toggleTask(task));

        const editButton = document.createElement("button");
        editButton.className = "edit-task";
        editButton.textContent = "Edit";
        editButton.addEventListener("click", () => editTask(task.id));

        const deleteButton = document.createElement("button");
        deleteButton.className = "delete-task";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", () => deleteTask(task.id));

        actions.append(toggleButton, editButton, deleteButton);
        item.append(content, actions);
        taskList.appendChild(item);
    });
}

async function getTaskById(id) {
    const response = await fetch(
        `${getTasksUrl()}?id=eq.${id}&select=*`,
        { headers: getHeaders() }
    );

    if (!response.ok) {
        throw new Error(await response.text());
    }

    const tasks = await response.json();
    return tasks[0];
}

async function addTask(title, description) {
    const response = await fetch(getTasksUrl(), {
        method: "POST",
        headers: getHeaders({ "Prefer": "return=representation" }),
        body: JSON.stringify({
            title: title,
            description: description,
            completed: false
        })
    });

    if (!response.ok) {
        throw new Error(await response.text());
    }
}

async function updateTask(id, updates) {
    const response = await fetch(
        `${getTasksUrl()}?id=eq.${id}`,
        {
            method: "PATCH",
            headers: getHeaders({ "Prefer": "return=representation" }),
            body: JSON.stringify(updates)
        }
    );

    if (!response.ok) {
        throw new Error(await response.text());
    }
}

async function deleteTask(id) {
    if (!confirm("Are you sure you want to delete this task?")) {
        return;
    }

    try {
        const response = await fetch(
            `${getTasksUrl()}?id=eq.${id}`,
            {
                method: "DELETE",
                headers: getHeaders()
            }
        );

        if (!response.ok) {
            throw new Error(await response.text());
        }

        if (editingTaskId === id) {
            resetForm();
        }

        showStatus("Task deleted successfully.");
        await loadTasks();
    } catch (error) {
        showStatus("Could not delete task: " + error.message, true);
    }
}

async function toggleTask(task) {
    try {
        await updateTask(task.id, {
            completed: !task.completed
        });

        showStatus("Task status updated.");
        await loadTasks();
    } catch (error) {
        showStatus("Could not update task: " + error.message, true);
    }
}

async function editTask(id) {
    try {
        const task = await getTaskById(id);

        if (!task) {
            throw new Error("Task not found.");
        }

        editingTaskId = task.id;
        titleInput.value = task.title;
        descriptionInput.value = task.description || "";

        submitButton.textContent = "Update Task";
        cancelButton.hidden = false;

        showStatus("Editing task #" + task.id);
        titleInput.focus();
    } catch (error) {
        showStatus("Could not open task: " + error.message, true);
    }
}

function resetForm() {
    editingTaskId = null;
    form.reset();
    submitButton.textContent = "Add Task";
    cancelButton.hidden = true;
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();

    if (!title) {
        showStatus("Please enter a task title.", true);
        return;
    }

    try {
        if (editingTaskId !== null) {
            await updateTask(editingTaskId, {
                title: title,
                description: description
            });

            showStatus("Task updated successfully.");
        } else {
            await addTask(title, description);
            showStatus("Task added successfully.");
        }

        resetForm();
        await loadTasks();
    } catch (error) {
        showStatus("Operation failed: " + error.message, true);
    }
});

cancelButton.addEventListener("click", resetForm);

async function initializeApp() {
    try {
        const response = await fetch("config.json");

        if (!response.ok) {
            throw new Error("Could not load config.json");
        }

        const config = await response.json();

        supabaseUrl = config.supabaseUrl.replace(/\/$/, "");
        supabaseKey = config.supabasePublishableKey;
        tableName = config.tableName || "tasks";

        if (!supabaseKey || supabaseKey.includes("THEIR_ACTUAL")) {
            throw new Error("Please check your Supabase publishable key in config.json.");
        }

        await loadTasks();
    } catch (error) {
        showStatus("Application initialization failed: " + error.message, true);
    }
}

initializeApp();
