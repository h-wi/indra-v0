const form = document.getElementById("chat-form");
const passwordInput = document.getElementById("password");
const promptInput = document.getElementById("prompt");
const answerNode = document.getElementById("answer");
const statusNode = document.getElementById("status");
const submitButton = document.getElementById("submit");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const password = passwordInput.value;
  const prompt = promptInput.value.trim();
  if (!password || !prompt) {
    setStatus("비밀번호와 질문을 모두 입력해줘.");
    return;
  }

  setLoading(true);
  answerNode.textContent = "";

  try {
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, prompt })
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok) {
      throw new Error(data.detail || data.error || "답변을 가져오지 못했어.");
    }

    answerNode.textContent = data.answer || "";
    setStatus("완료");
  } catch (error) {
    answerNode.textContent = "";
    setStatus(error.message || "오류가 났어.");
  } finally {
    setLoading(false);
  }
});

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  promptInput.disabled = isLoading;
  passwordInput.disabled = isLoading;
  if (isLoading) setStatus("생각 중...");
}

function setStatus(message) {
  statusNode.textContent = message;
}
