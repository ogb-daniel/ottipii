chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetch_otp") {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        sendResponse({
          success: false,
          error: chrome.runtime.lastError.message,
        });
        return;
      }
      fetchEmails(token).then((otp) => {
        sendResponse({ success: true, otp });
      });
    });
    return true;
  }
});

async function fetchEmails(token) {
  try {
    const listResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults=5",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    const listData = await listResponse.json();
    if (!listData.messages || listData.messages.length === 0) {
      console.log("No unread messages found.");
      return;
    }

    const latestMessageId = listData.messages[0].id;

    const detailResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${latestMessageId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const detailData = await detailResponse.json();
    const otp = extractOTP(detailData.snippet);
    if (otp) {
      return otp;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}

function extractOTP(text) {
  const codePattern =
    /(?<=(?:otp|code|verification|pin|passcode|v-code)\D*)\d{4,8}/i;

  const matches = text.match(codePattern);
  if (matches) {
    return matches[0];
  }
  return null;
}
