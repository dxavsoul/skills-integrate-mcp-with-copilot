document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const teacherOnlyNote = document.getElementById("teacher-only-note");

  const userMenuButton = document.getElementById("user-menu-button");
  const userMenu = document.getElementById("user-menu");
  const showLoginButton = document.getElementById("show-login-button");
  const loginForm = document.getElementById("login-form");
  const loggedOutSection = document.getElementById("auth-logged-out");
  const loggedInSection = document.getElementById("auth-logged-in");
  const teacherName = document.getElementById("teacher-name");
  const logoutButton = document.getElementById("logout-button");

  let teacherToken = localStorage.getItem("teacherToken") || "";
  let teacherUsername = "";

  function getAuthHeaders() {
    if (!teacherToken) {
      return {};
    }

    return {
      Authorization: `Bearer ${teacherToken}`,
    };
  }

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function updateAuthUI() {
    const isTeacher = Boolean(teacherToken);

    if (isTeacher) {
      loggedOutSection.classList.add("hidden");
      loginForm.classList.add("hidden");
      loggedInSection.classList.remove("hidden");
      teacherName.textContent = `Signed in as ${teacherUsername}`;

      signupForm.classList.remove("form-disabled");
      Array.from(signupForm.elements).forEach((element) => {
        element.disabled = false;
      });

      teacherOnlyNote.textContent =
        "Teacher mode is active. You can register and unregister students.";
    } else {
      loggedOutSection.classList.remove("hidden");
      loggedInSection.classList.add("hidden");

      signupForm.classList.add("form-disabled");
      Array.from(signupForm.elements).forEach((element) => {
        element.disabled = true;
      });

      teacherOnlyNote.textContent =
        "Teacher login required to register or unregister students.";
    }
  }

  async function initializeAuth() {
    if (!teacherToken) {
      updateAuthUI();
      return;
    }

    try {
      const response = await fetch("/auth/me", {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        teacherToken = "";
        teacherUsername = "";
        localStorage.removeItem("teacherToken");
      } else {
        const result = await response.json();
        teacherUsername = result.teacher;
      }
    } catch (error) {
      teacherToken = "";
      teacherUsername = "";
      localStorage.removeItem("teacherToken");
      console.error("Error validating teacher session:", error);
    }

    updateAuthUI();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        teacherToken
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      if (teacherToken) {
        // Add event listeners to delete buttons for teachers only.
        document.querySelectorAll(".delete-btn").forEach((button) => {
          button.addEventListener("click", handleUnregister);
        });
      }
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  userMenuButton.addEventListener("click", () => {
    userMenu.classList.toggle("hidden");
  });

  showLoginButton.addEventListener("click", () => {
    loginForm.classList.toggle("hidden");
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("teacher-username").value.trim();
    const password = document.getElementById("teacher-password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        showMessage(result.detail || "Login failed", "error");
        return;
      }

      teacherToken = result.token;
      teacherUsername = result.teacher;
      localStorage.setItem("teacherToken", teacherToken);
      loginForm.reset();
      loginForm.classList.add("hidden");
      updateAuthUI();
      fetchActivities();
      showMessage("Teacher login successful.", "success");
    } catch (error) {
      showMessage("Failed to login. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  logoutButton.addEventListener("click", async () => {
    try {
      await fetch("/auth/logout", {
        method: "POST",
        headers: getAuthHeaders(),
      });
    } catch (error) {
      console.error("Error logging out:", error);
    }

    teacherToken = "";
    teacherUsername = "";
    localStorage.removeItem("teacherToken");
    updateAuthUI();
    fetchActivities();
    showMessage("Logged out.", "info");
  });

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  initializeAuth();
  fetchActivities();
});
