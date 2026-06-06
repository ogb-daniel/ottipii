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
  if (!text) return null;

  // --- Configuration ---
  const OTP_KEYWORDS = [
    "otp",
    "code",
    "verification",
    "verify",
    "pin",
    "passcode",
    "v-code",
    "one-time",
    "one time",
    "security code",
    "2fa",
    "mfa",
    "token",
    "confirmation",
    "confirm",
    "authenticate",
    "authentication",
    "login code",
    "sign-in code",
    "signin code",
    "access code",
    "temporary password",
  ];

  const FALSE_POSITIVE_PATTERNS = [
    /^20[1-3]\d$/, // Years 2010–2039
    /^\d{10,}$/, // Phone numbers (10+ digits)
    /^0\d+/, // Leading zero (unlikely OTP, more likely ID)
  ];

  // --- Helpers ---
  function isFalsePositive(candidate) {
    return FALSE_POSITIVE_PATTERNS.some((pat) => pat.test(candidate));
  }

  function normalise(str) {
    return str.toLowerCase().replace(/[^a-z0-9]/g, " ");
  }

  // --- Strategy 1: Keyword-adjacent numbers ---
  // Find all 4-8 digit numbers and score them by proximity to a keyword.
  const normalisedText = normalise(text);
  const digitMatches = [...text.matchAll(/\b(\d{4,8})\b/g)];
  let bestCandidate = null;
  let bestScore = Infinity;

  for (const m of digitMatches) {
    const candidate = m[1];
    if (isFalsePositive(candidate)) continue;

    const pos = m.index;
    for (const kw of OTP_KEYWORDS) {
      let searchStart = 0;
      while (true) {
        const kwPos = normalisedText.indexOf(kw, searchStart);
        if (kwPos === -1) break;
        const distance = Math.abs(pos - kwPos);
        if (distance < bestScore) {
          bestScore = distance;
          bestCandidate = candidate;
        }
        searchStart = kwPos + 1;
      }
    }
  }

  // Accept if the keyword was reasonably close (within ~80 chars).
  if (bestCandidate && bestScore <= 80) {
    return bestCandidate;
  }

  // --- Strategy 2: Common explicit patterns ---
  // "Your code is: 123456" / "OTP – 1234" / "code=582910"
  const explicitPatterns = [
    /(?:is|[=:–—-])\s*(\d{4,8})\b/i,
    /\b(\d{4,8})\s*(?:is your|is the)/i,
  ];

  for (const pat of explicitPatterns) {
    const match = text.match(pat);
    if (match && !isFalsePositive(match[1])) {
      return match[1];
    }
  }

  // --- Strategy 3: Standalone prominent number ---
  // If there's exactly one 4-8 digit number in the entire snippet, it's
  // very likely the OTP (many emails just say "Use 482910 to log in").
  const allDigitGroups = digitMatches
    .map((m) => m[1])
    .filter((c) => !isFalsePositive(c));

  if (allDigitGroups.length === 1) {
    return allDigitGroups[0];
  }

  return null;
}
