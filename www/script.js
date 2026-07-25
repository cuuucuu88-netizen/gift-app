const firebaseConfig = {
  apiKey: "AIzaSyDT0WL4GHIqvf7N1uFeDN9MV231xOb4FcA",
  authDomain: "rewards-yasser.firebaseapp.com",
  projectId: "rewards-yasser",
  storageBucket: "rewards-yasser.firebasestorage.app",
  messagingSenderId: "763320902114",
  appId: "1:763320902114:web:3fedc979e5a17bb42ed9bb"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let points = 0;
let lastSpinTime = 0;
let isSpinning = false;
let usedCoupons = [];

const validCoupons = {
    "SOSO": 500,
    "JANA": 500,
    "AMER": 500,
    "OMAR": 500,
    "QAMAR": 500,
    "FARAH": 500
};

function showCustomAlert(message, title = "تنبيه", icon = "✨") {
    document.getElementById('custom-alert-title').innerText = title;
    document.getElementById('custom-alert-message').innerText = message;
    document.getElementById('custom-alert-icon').innerText = icon;
    document.getElementById('custom-alert-modal').style.display = 'flex';
}

function closeCustomAlert() {
    document.getElementById('custom-alert-modal').style.display = 'none';
}

function speakText(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const msg = new SpeechSynthesisUtterance(text);
        msg.lang = 'ar-SA';
        msg.rate = 0.9;
        
        if (window.speechSynthesis.getVoices().length === 0) {
            window.speechSynthesis.onvoiceschanged = () => {
                window.speechSynthesis.speak(msg);
            };
        } else {
            window.speechSynthesis.speak(msg);
        }
    }
}

document.addEventListener('click', function unlockAudio() {
    if ('speechSynthesis' in window) {
        const dummyMsg = new SpeechSynthesisUtterance("");
        window.speechSynthesis.speak(dummyMsg);
    }
    document.removeEventListener('click', unlockAudio);
}, { once: true });

window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) splash.style.display = 'none';
        
        if (!auth.currentUser) {
            const slide1 = document.getElementById('onboarding-slide-1');
            if (slide1) slide1.style.display = 'flex';
        }
    }, 2000);
});

function nextSlide() {
    document.getElementById('onboarding-slide-1').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
}

auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        const splash = document.getElementById('splash-screen');
        if (splash) splash.style.display = 'none';
        const slide1 = document.getElementById('onboarding-slide-1');
        if (slide1) slide1.style.display = 'none';
        const loginScr = document.getElementById('login-screen');
        if (loginScr) loginScr.style.display = 'none';

        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('user-display-name').innerText = user.displayName || "مستخدم";
        document.getElementById('user-email-text').innerText = user.email || "";
        loadUserData(user.uid);
    } else {
        currentUser = null;
        document.getElementById('user-display-name').innerText = "زائر";
        document.getElementById('user-email-text').innerText = "يرجى تسجيل الدخول";
        document.getElementById('user-points').innerText = 0;
    }
});

function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithRedirect(provider);
}

function loadUserData(userId) {
    db.collection('users').doc(userId).get().then((doc) => {
        if (doc.exists) {
            const data = doc.data();
            points = data.points || 0;
            lastSpinTime = data.lastSpinTime || 0;
            usedCoupons = data.usedCoupons || [];
        } else {
            points = 0;
            lastSpinTime = 0;
            usedCoupons = [];
            db.collection('users').doc(userId).set({ points: 0, lastSpinTime: 0, usedCoupons: [] });
        }
        document.getElementById('user-points').innerText = points;
        checkWheelAvailability();
    });
}

function updatePoints(newPoints) {
    points = newPoints;
    document.getElementById('user-points').innerText = points;
    if (currentUser) {
        db.collection('users').doc(currentUser.uid).update({ points: points });
    }
}

function redeemCoupon() {
    if (!currentUser) {
        speakText("فشل الاستبدال");
        showCustomAlert("يرجى تسجيل الدخول أولاً لاستخدام الكوبونات!", "تنبيه", "🔒");
        return;
    }

    const inputField = document.getElementById('coupon-code-input');
    const code = inputField.value.trim().toUpperCase();

    if (!code) {
        speakText("فشل الاستبدال");
        showCustomAlert("يرجى إدخال رمز الكوبون!", "خطأ", "⚠️");
        return;
    }

    if (!validCoupons.hasOwnProperty(code)) {
        speakText("فشل الاستبدال");
        showCustomAlert("رمز الكوبون غير صحيح أو منتهي الصلاحية!", "خطأ", "❌");
        return;
    }

    if (!Array.isArray(usedCoupons)) {
        usedCoupons = [];
    }

    if (usedCoupons.includes(code)) {
        speakText("تم الاستبدال مسبقا");
        showCustomAlert("لقد قمت باستخدام هذا الكوبون من قبل بهذا الحساب!", "تنبيه", "⚠️");
        return;
    }

    const couponReward = validCoupons[code];
    usedCoupons.push(code);

    db.collection('users').doc(currentUser.uid).update({
        points: points + couponReward,
        usedCoupons: usedCoupons
    }).then(() => {
        points += couponReward;
        document.getElementById('user-points').innerText = points;
        speakText("نجح الاستبدال");
        showCustomAlert(`تم تفعيل الكوبون بنجاح واستلام ${couponReward} نقطة!`, "مبروك 🎉", "🎁");
        inputField.value = '';
    }).catch((error) => {
        console.error("خطأ في قاعدة البيانات:", error);
        showCustomAlert("حدث خطأ أثناء الاتصال بقاعدة البيانات، تأكد من اتصال الإنترنت.", "خطأ شبكة", "🌐");
    });
}

const comprehensiveGeneralQuestions = [
    { q: "ما هي الدولة التي تمتلك أكبر عدد من الجزر في العالم؟", options: ["السويد", "إندونيسيا", "كندا", "النرويج"], correct: 0 },
    { q: "في أي عام تم إطلاق أول قمر صناعي (سبوتنيك 1)؟", options: ["1955", "1957", "1961", "1965"], correct: 1 },
    { q: "من هو واضع علم الجبر؟", options: ["الخوارزمي", "ابن الهيثم", "البيروني", "جابر بن حيان"], correct: 0 },
    { q: "ما هو العنصر الكيميائي الذي يرمز له بالحرف (W)؟", options: ["التنجستن", "الذهب", "الفضة", "النحاس"], correct: 0 },
    { q: "أين يقع أعمق خندق مائي في العالم (خندق ماريانا)؟", options: ["المحيط الأطلسي", "المحيط الهادئ", "المحيط الهندي", "المحيط المتجمد الشمالي"], correct: 1 },
    { q: "ما هي عاصمة دولة أستراليا؟", options: ["كانبرا", "سيدني", "ملبورن", "بريزبان"], correct: 0 },
    { q: "ما هي عاصمة كندا؟", options: ["تورونتو", "فانكوفر", "أوتاوا", "مونريال"], correct: 2 },
    { q: "ما هو العنصر الأكثر توافراً في قشرة الأرض؟", options: ["الأكسجين", "الحديد", "السيليكون", "الألومنيوم"], correct: 0 },
    { q: "من هو مكتشف قانون الجاذبية الأرضية؟", options: ["ألبرت أينشتاين", "إسحاق نيوتن", "جاليليو جاليلي", "نيكولا تسلا"], correct: 1 },
    { q: "ما هي الدولة الأكثر إنتاجاً للقهوة في العالم؟", options: ["كولومبيا", "فيتنام", "البرازيل", "إثيوبيا"], correct: 2 },
    { q: "في أي قارة تقع دولة مدغشقر؟", options: ["آسيا", "أفريقيا", "أستراليا", "أمريكا الجنوبية"], correct: 1 },
    { q: "ما هو أكبر كوكب في المجموعة الشمسية؟", options: ["زحل", "المشتري", "المريخ", "نبتون"], correct: 1 },
    { q: "ما هي عاصمة اليابان؟", options: ["كيوتو", "أوساكا", "طوكيو", "هيروشيما"], correct: 2 },
    { q: "كم عدد ألوان قزح الرئيسية؟", options: ["5 ألوان", "6 ألوان", "7 ألوان", "8 ألوان"], correct: 2 },
    { q: "ما هو الحيوان الذي يُسمى سفين الصحراء؟", options: ["الحصان", "الجمل", "الفيل", "الأسد"], correct: 1 },
    { q: "ما هو الغاز الرئيسي الذي تتكون منه الشمس؟", options: ["الأكسجين", "النيتروجين", "الهيدروجين", "ثاني أكسيد الكربون"], correct: 2 },
    { q: "ما هي عاصمة إيطاليا؟", options: ["ميلانو", "روما", "البندقية", "فلورنسا"], correct: 1 },
    { q: "من هو أول إنسان صعد إلى الفضاء؟", options: ["نيل أرمسترونغ", "يوري غاغارين", "باز ألدرين", "جون غلين"], correct: 1 },
    { q: "ما هو أسرع حيوان بري في العالم؟", options: ["الأسد", "الفهد", "الغزال", "الحصان"], correct: 1 },
    { q: "ما هي عاصمة جمهورية مصر العربية؟", options: ["الإسكندرية", "القاهرة", "الجيزة", "الأقصر"], correct: 1 },
    { q: "أي من الأجهزة التالية يُستخدم لقياس الزلازل؟", options: ["الباروميتر", "السييسموجراف", "الثيرموميتر", "الأنيموميتر"], correct: 1 },
    { q: "ما هو أطول نهر في العالم؟", options: ["نهر الأمازون", "نهر النيل", "نهر المسيسبي", "نهر الدانوب"], correct: 1 },
    { q: "ما هي عاصمة فرنسا؟", options: ["مارسيليا", "ليون", "باريس", "نيس"], correct: 2 },
    { q: "كم عدد أضلاع الشكل الخماسي المنتظم؟", options: ["4 أضلاع", "5 أضلاع", "6 أضلاع", "7 أضلاع"], correct: 1 },
    { q: "ما هو المعدن السائل في درجة حرارة الغرفة؟", options: ["الحديد", "الزئبق", "النحاس", "الرصاص"], correct: 1 },
    { q: "في اي دولة يقع برج إيفل؟", options: ["إيطاليا", "إسبانيا", "فرنسا", "بريطانيا"], correct: 2 },
    { q: "ما هو الحيوان المعروف بذاكرته القوية وطوله الفارع؟", options: ["الزرافة", "الفيل", "الحوت", "القرش"], correct: 1 },
    { q: "ما هي عاصمة المملكة العربية السعودية؟", options: ["جدة", "الرياض", "الدمام", "مكة المكرمة"], correct: 1 }
];

let currentQuizQuestion = null;
let askedQuestionIds = new Set();

function startQuiz(type) {
    if (!currentUser) {
        showCustomAlert("يرجى تسجيل الدخول أولاً!", "تنبيه", "🔒");
        return;
    }

    if (type === 'math') {
        let n1 = Math.floor(Math.random() * 90) + 10;
        let n2 = Math.floor(Math.random() * 90) + 10;
        let correctAns = n1 + n2;
        let options = [correctAns, correctAns + 2, correctAns - 3, correctAns + 5];
        options.sort(() => Math.random() - 0.5);
        currentQuizQuestion = {
            q: `ما هو ناتج جمع ${n1} + ${n2} ؟`,
            options: options.map(String),
            correct: options.indexOf(correctAns)
        };
    } else {
        if (askedQuestionIds.size >= comprehensiveGeneralQuestions.length) {
            askedQuestionIds.clear(); 
        }

        let randomIndex;
        do {
            randomIndex = Math.floor(Math.random() * comprehensiveGeneralQuestions.length);
        } while (askedQuestionIds.has(randomIndex));

        askedQuestionIds.add(randomIndex);
        const selected = comprehensiveGeneralQuestions[randomIndex];

        currentQuizQuestion = {
            q: selected.q,
            options: selected.options,
            correct: selected.correct
        };
    }

    document.getElementById('quiz-question').innerText = currentQuizQuestion.q;
    const optionsDiv = document.getElementById('quiz-options');
    optionsDiv.innerHTML = '';

    currentQuizQuestion.options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.className = 'quiz-opt-btn';
        btn.innerText = opt;
        btn.onclick = () => checkAnswer(index);
        optionsDiv.appendChild(btn);
    });

    document.getElementById('quiz-modal').style.display = 'flex';
}

function checkAnswer(selectedIndex) {
    document.getElementById('quiz-modal').style.display = 'none';
    if (selectedIndex === currentQuizQuestion.correct) {
        updatePoints(points + 1); 
        speakText("إجابة صحيحة");
        showCustomAlert("إجابة صحيحة! تم إضافة +1 نقطة لرصيدك.", "ممتاز 🎉", "✅");
    } else {
        speakText("إجابة خاطئة");
        showCustomAlert("إجابة خاطئة! حاول في سؤال آخر.", "تنبيه", "❌");
    }
}

function closeQuizModal() {
    document.getElementById('quiz-modal').style.display = 'none';
}

function showRewardAd() {
    if (!currentUser) {
        showCustomAlert("يرجى تسجيل الدخول أولاً!", "تنبيه", "🔒");
        return;
    }

    const adModal = document.getElementById('ad-modal');
    const adSecondsSpan = document.getElementById('ad-seconds');
    let timeLeft = 5;

    adSecondsSpan.innerText = timeLeft;
    adModal.style.display = 'flex';

    const timer = setInterval(() => {
        timeLeft--;
        adSecondsSpan.innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timer);
            adModal.style.display = 'none';
            updatePoints(points + 20);
            showCustomAlert("تم مشاهدة الإعلان بنجاح! تم منحك +20 نقطة!", "مكافأة 💎", "📺");
        }
    }, 1000);
}

let currentGameReward = 0;
let currentTaps = 0;

function openGameModal(gameName, reward) {
    if (!currentUser) {
        showCustomAlert("يرجى تسجيل الدخول أولاً!", "تنبيه", "🔒");
        return;
    }

    currentGameReward = reward;
    currentTaps = 0;
    document.getElementById('game-title').innerText = `🎮 لعبة: ${gameName}`;
    document.getElementById('tap-count').innerText = 0;

    const gameModal = document.getElementById('game-modal');
    const gameSecondsSpan = document.getElementById('game-seconds');
    let timeLeft = 10;

    gameSecondsSpan.innerText = timeLeft;
    gameModal.style.display = 'flex';

    const timer = setInterval(() => {
        timeLeft--;
        gameSecondsSpan.innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timer);
            gameModal.style.display = 'none';
            if (currentTaps >= 5) {
                updatePoints(points + currentGameReward);
                showCustomAlert(`أحسنت! أنجزت اللعبة وحصلت على +${currentGameReward} نقطة!`, "مبروك 🎉", "🎮");
            } else {
                showCustomAlert("لم تضغط بعدد كافٍ! حاول مجدداً للحصول على النقاط.", "حاول مجدداً", "😅");
            }
        }
    }, 1000);
}

function registerTap() {
    currentTaps++;
    document.getElementById('tap-count').innerText = currentTaps;
}

function checkWheelAvailability() {
    const now = Date.now();
    const spinBtn = document.getElementById('spin-btn');
    const timerText = document.getElementById('wheel-timer');
    const cooldown = 24 * 60 * 60 * 1000;

    if (now - lastSpinTime >= cooldown) {
        spinBtn.disabled = false;
        timerText.innerText = "العجلة جاهزة للتدوير الآن!";
    } else {
        spinBtn.disabled = true;
        const remainingMs = cooldown - (now - lastSpinTime);
        const hours = Math.floor(remainingMs / (1000 * 60 * 60));
        const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        timerText.innerText = `متاحة بعد: ${hours} ساعة و ${minutes} دقيقة`;
    }
}

function spinWheel() {
    if (!currentUser) {
        showCustomAlert("يرجى تسجيل الدخول أولاً!", "تنبيه", "🔒");
        return;
    }
    if (isSpinning) return;

    isSpinning = true;
    document.getElementById('spin-btn').disabled = true;

    const rewards = [
        { points: 10,  deg: 30 },
        { points: 30,  deg: 90 },
        { points: 70,  deg: 150 },
        { points: 0,   deg: 210 },
        { points: 100, deg: 270 },
        { points: 500, deg: 330 }
    ];

    let prize;
    const randomPercent = Math.random() * 100;

    if (randomPercent < 10) {
        prize = rewards[5]; 
    } else {
        const otherOptions = [rewards[0], rewards[1], rewards[2], rewards[3], rewards[4]];
        prize = otherOptions[Math.floor(Math.random() * otherOptions.length)];
    }

    const wheelWrapper = document.getElementById('wheel-wrapper');
    const totalRotation = 360 * 5 + (360 - prize.deg);

    wheelWrapper.style.transform = `rotate(${totalRotation}deg)`;

    setTimeout(() => {
        isSpinning = false;
        lastSpinTime = Date.now();
        db.collection('users').doc(currentUser.uid).update({ lastSpinTime: lastSpinTime });
        
        if (prize.points > 0) {
            updatePoints(points + prize.points);
            showCustomAlert(`مبروك! حصلت على ${prize.points} نقطة!`, "نتيجة العجلة 🎡", "💎");
        } else {
            showCustomAlert("حظاً أوفر في المرة القادمة! حصلت على 0 نقطة.", "حظ سيء", "😅");
        }

        wheelWrapper.style.transition = 'none';
        wheelWrapper.style.transform = `rotate(${360 - prize.deg}deg)`;
        setTimeout(() => wheelWrapper.style.transition = 'transform 4s cubic-bezier(0.15, 0.99, 0.35, 1)', 50);
        checkWheelAvailability();
    }, 4000);
}

function redeemPrize(prizeName, cost, inputId) {
    if (!currentUser) {
        showCustomAlert("يرجى تسجيل الدخول أولاً!", "تنبيه", "🔒");
        return;
    }
    let playerId = document.getElementById(inputId).value.trim();
    if (!playerId) {
        showCustomAlert("يرجى إدخال الـ ID أولاً!", "تنبيه", "⚠️");
        return;
    }
    if (points < cost) {
        showCustomAlert("رصيد النقاط غير كافٍ!", "عذراً", "💎");
        return;
    }

    updatePoints(points - cost);
    db.collection('orders').add({
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email,
        prize: prizeName,
        playerId: playerId,
        status: "Pending",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        showCustomAlert(`تم إرسال طلب ${prizeName} بنجاح!`, "تم الطلب بنجاح", "🛒");
        document.getElementById(inputId).value = '';
    });
}
// رقم الإصدار الحالي لتطبيقك (قم بزيادته مستقبلاً إذا أضفت تحديثاً جديداً)
const CURRENT_APP_VERSION = "1.0"; 

async function checkAppVersion() {
    try {
        const docRef = db.collection("settings").doc("app_version");
        const doc = await docRef.get();

        if (doc.exists) {
            const latestVersion = doc.data().version; // النسخة المطلوبة في السيرفر
            const updateUrl = doc.data().url;         // رابط تحميل التحديث الجديد

            // إذا كانت النسخة الحالية تختلف عن نسخة السيرفر، يتم إظهار شاشة التحديث الإجباري
            if (latestVersion !== CURRENT_APP_VERSION) {
                document.getElementById('force-update-modal').style.display = 'flex';
                window.appUpdateLink = updateUrl;
            }
        }
    } catch (error) {
        console.log("خطأ في التحقق من التحديث:", error);
    }
}

// دالة الانتقال لرابط التحميل عند الضغط على زر التحديث
function openUpdateLink() {
    if (window.appUpdateLink) {
        window.location.href = window.appUpdateLink;
    } else {
        alert("يرجى مراجعة قناة التطبيق لتحميل التحديث.");
    }
}

// تشغيل الفحص فور فتح التطبيق
window.addEventListener('DOMContentLoaded', () => {
    checkAppVersion();
});
