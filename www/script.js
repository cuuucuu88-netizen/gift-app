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
let isGuest = false;
let points = 0;
let lastSpinTime = 0;
let isSpinning = false;
let usedCoupons = [];
let pendingEmail = "";
let pendingPassword = "";

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

function showLoginScreen() {
    isGuest = false;
    document.getElementById('login-screen').style.display = 'flex';
}

function logoutUser() {
    auth.signOut().then(() => {
        isGuest = false;
        currentUser = null;
        points = 0;
        
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('user-display-name').innerText = "زائر";
        document.getElementById('user-email-text').innerText = "يرجى تسجيل الدخول";
        document.getElementById('user-points').innerText = 0;
        
        document.getElementById('logout-btn').style.display = 'none';
        const loginBtnElem = document.getElementById('show-login-btn');
        if (loginBtnElem) loginBtnElem.style.display = 'block';

        showCustomAlert("تم تسجيل الخروج بنجاح.", "تنبيه", "👋");
    }).catch((error) => {
        showCustomAlert("حدث خطأ أثناء تسجيل الخروج: " + error.message, "خطأ", "❌");
    });
}

window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.display = 'none';
        }
        
        if (!auth.currentUser && !isGuest) {
            const slide1 = document.getElementById('onboarding-slide-1');
            if (slide1) {
                slide1.style.display = 'flex';
            } else {
                const loginScr = document.getElementById('login-screen');
                if (loginScr) loginScr.style.display = 'flex';
            }
        }
    }, 2000);

    checkAppVersion();
});

function nextSlide() {
    document.getElementById('onboarding-slide-1').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
}

// إرسال كود الـ OTP عبر EmailJS بالمعرفات الصحيحة
function registerWithEmail() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value.trim();

    if (!email || !password) {
        showCustomAlert("يرجى إدخال البريد الإلكتروني وكلمة السر لإنشاء الحساب!", "خطأ", "⚠️");
        return;
    }

    pendingEmail = email;
    pendingPassword = password;

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    db.collection('pending_otps').doc(email).set({
        otp: otpCode,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        showCustomAlert("جاري إرسال كود التحقق إلى بريدك الإلكتروني...", "انتظر قليلاً", "⏳");

        // استخدام الـ Service ID والـ Template ID الصحيحين بحروف صغيرة
        emailjs.send("service_l4cp7bl", "template_6b8jdk8", {
            to_email: email,
            otp_code: otpCode
        }).then(() => {
            closeCustomAlert();
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('otp-modal').style.display = 'flex';
            showCustomAlert(`تم إرسال كود التحقق إلى ${email}. يرجى تفقد بريدك وإدخاله هنا.`, "تم إرسال الكود", "✉️");
        }, (error) => {
            showCustomAlert("فشل إرسال البريد الإلكتروني، تأكد من صحة الإيميل: " + JSON.stringify(error), "خطأ", "❌");
        });

    }).catch((error) => {
        showCustomAlert("خطأ في نظام التحقق: " + error.message, "خطأ", "❌");
    });
}

function verifyOtpCode() {
    const enteredOtp = document.getElementById('otp-code-input').value.trim();

    if (!enteredOtp) {
        showCustomAlert("يرجى إدخال كود التحقق!", "خطأ", "⚠️");
        return;
    }

    db.collection('pending_otps').doc(pendingEmail).get().then((doc) => {
        if (!doc.exists) {
            showCustomAlert("انتهت صلاحية الكود، يرجى إعادة المحاولة.", "خطأ", "❌");
            return;
        }

        const storedOtp = doc.data().otp;

        if (storedOtp === enteredOtp) {
            auth.createUserWithEmailAndPassword(pendingEmail, pendingPassword)
                .then((userCredential) => {
                    db.collection('pending_otps').doc(pendingEmail).delete();
                    document.getElementById('otp-modal').style.display = 'none';
                    isGuest = false;
                    showCustomAlert("تم تأكيد البريد وإنشاء الحساب بنجاح!", "مرحباً", "🎉");
                })
                .catch((error) => {
                    if (error.code === 'auth/email-already-in-use') {
                        // إذا كان الإيميل مسجلاً مسبقاً، قم بتسجيل الدخول مباشرة به
                        auth.signInWithEmailAndPassword(pendingEmail, pendingPassword)
                            .then(() => {
                                db.collection('pending_otps').doc(pendingEmail).delete();
                                document.getElementById('otp-modal').style.display = 'none';
                                isGuest = false;
                                showCustomAlert("هذا البريد مستخدم مسبقاً، تم تسجيل الدخول بنجاح!", "مرحباً بعودتك", "🎉");
                            })
                            .catch((loginError) => {
                                showCustomAlert("كلمة المرور غير صحيحة لهذا البريد المسجل مسبقاً.", "خطأ", "❌");
                            });
                    } else {
                        showCustomAlert("فشل إنشاء الحساب: " + error.message, "خطأ", "❌");
                    }
                });
        } else {
            showCustomAlert("كود التحقق غير صحيح، حاول مرة أخرى.", "خطأ", "❌");
        }
    });
}

function closeOtpModal() {
    document.getElementById('otp-modal').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
}

function loginWithEmail() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value.trim();

    if (!email || !password) {
        showCustomAlert("يرجى إدخال البريد الإلكتروني وكلمة السر!", "خطأ", "⚠️");
        return;
    }

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            isGuest = false;
            document.getElementById('login-screen').style.display = 'none';
            showCustomAlert("مرحباً بك، تم تسجيل الدخول بنجاح!", "نجاح", "🎉");
        })
        .catch((error) => {
            showCustomAlert("فشل تسجيل الدخول: " + error.message, "خطأ", "❌");
        });
}

function loginAsGuest() {
    isGuest = true;
    currentUser = null;
    points = 0;
    
    const splash = document.getElementById('splash-screen');
    if (splash) splash.style.display = 'none';
    const slide1 = document.getElementById('onboarding-slide-1');
    if (slide1) slide1.style.display = 'none';
    const loginScr = document.getElementById('login-screen');
    if (loginScr) loginScr.style.display = 'none';

    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('user-display-name').innerText = "زائر (ضيف)";
    document.getElementById('user-email-text').innerHTML = 'وضع الضيف - بدون صلاحيات';
    
    const loginBtnElem = document.getElementById('show-login-btn');
    if (loginBtnElem) loginBtnElem.style.display = 'block';
    
    const logoutBtnElem = document.getElementById('logout-btn');
    if (logoutBtnElem) logoutBtnElem.style.display = 'none';

    document.getElementById('user-points').innerText = 0;
    
    showCustomAlert("تم الدخول كضيف. يمكنك تصفح التطبيق، ولكن لن تتمكن من جمع النقاط أو الشراء حتى تقوم بتسجيل الدخول بحساب حقيقي.", "تنبيه الضيف", "👤");
}

auth.onAuthStateChanged((user) => {
    const loginBtnElem = document.getElementById('show-login-btn');
    const logoutBtnElem = document.getElementById('logout-btn');

    if (user && !isGuest) {
        currentUser = user;
        const splash = document.getElementById('splash-screen');
        if (splash) splash.style.display = 'none';
        const slide1 = document.getElementById('onboarding-slide-1');
        if (slide1) slide1.style.display = 'none';
        const loginScr = document.getElementById('login-screen');
        if (loginScr) loginScr.style.display = 'none';

        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('user-display-name').innerText = user.displayName || user.email.split('@')[0];
        document.getElementById('user-email-text').innerText = user.email || "";

        if (loginBtnElem) loginBtnElem.style.display = 'none';
        if (logoutBtnElem) logoutBtnElem.style.display = 'block';

        loadUserData(user.uid);
    } else if (!isGuest) {
        currentUser = null;
        document.getElementById('user-display-name').innerText = "زائر";
        document.getElementById('user-email-text').innerText = "يرجى تسجيل الدخول";
        document.getElementById('user-points').innerText = 0;

        if (loginBtnElem) loginBtnElem.style.display = 'block';
        if (logoutBtnElem) logoutBtnElem.style.display = 'none';
    }
});

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
    if (isGuest) {
        showCustomAlert("عذراً، وضع الضيف لا يسمح بجمع النقاط. يرجى تسجيل الدخول بحسابك!", "تنبيه", "🔒");
        return;
    }
    points = newPoints;
    document.getElementById('user-points').innerText = points;
    if (currentUser) {
        db.collection('users').doc(currentUser.uid).update({ points: points });
    }
}

function redeemCoupon() {
    if (isGuest || !currentUser) {
        showCustomAlert("لا يمكنك استخدام الكوبونات وأنت تتصفح كضيف! يرجى تسجيل الدخول.", "تنبيه", "🔒");
        return;
    }

    const inputField = document.getElementById('coupon-code-input');
    const code = inputField.value.trim().toUpperCase();

    if (!code) {
        showCustomAlert("يرجى إدخال رمز الكوبون!", "خطأ", "⚠️");
        return;
    }

    if (!validCoupons.hasOwnProperty(code)) {
        showCustomAlert("رمز الكوبون غير صحيح أو منتهي الصلاحية!", "خطأ", "❌");
        return;
    }

    if (!Array.isArray(usedCoupons)) {
        usedCoupons = [];
    }

    if (usedCoupons.includes(code)) {
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
        showCustomAlert(`تم تفعيل الكوبون بنجاح واستلام ${couponReward} نقطة!`, "مبروك 🎉", "🎁");
        inputField.value = '';
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
    if (isGuest || !currentUser) {
        showCustomAlert("وضع الضيف لا يتيح لك لعب اختبارات لجمع النقاط. سجل الدخول الآن!", "تنبيه", "🔒");
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
        showCustomAlert("إجابة صحيحة! تم إضافة +1 نقطة لرصيدك.", "ممتاز 🎉", "✅");
    } else {
        showCustomAlert("إجابة خاطئة! حاول في سؤال آخر.", "تنبيه", "❌");
    }
}

function closeQuizModal() {
    document.getElementById('quiz-modal').style.display = 'none';
}

function showRewardAd() {
    if (isGuest || !currentUser) {
        showCustomAlert("لا يمكنك مشاهدة الإعلانات لجمع النقاط وأنت ضيف!", "تنبيه", "🔒");
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
    if (isGuest || !currentUser) {
        showCustomAlert("الضيوف غير مسموح لهم بلعب الألعاب لكسب النقاط. سجل الدخول!", "تنبيه", "🔒");
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
    if (isGuest || !currentUser) {
        showCustomAlert("تدوير العجلة مخصص للأعضاء المسجلين فقط!", "تنبيه", "🔒");
        return;
    }
    if (isSpinning) return;

    isSpinning = true;
    document.getElementById('spin-btn').disabled = true;

    const rewards = [
        { points: 10, deg: 30 },
        { points: 30, deg: 90 },
        { points: 70, deg: 150 },
        { points: 0, deg: 210 },
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
    if (isGuest || !currentUser) {
        showCustomAlert("لا يمكنك الشراء أو الاستبدال وأنت تتصفح كضيف! سجل الدخول الآن.", "تنبيه", "🔒");
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

const CURRENT_APP_VERSION = "1.0"; 

async function checkAppVersion() {
    try {
        const docRef = db.collection("settings").doc("app_version");
        const doc = await docRef.get();

        if (doc.exists) {
            const latestVersion = doc.data().version; 
            const updateUrl = doc.data().url;         

            if (latestVersion !== CURRENT_APP_VERSION) {
                document.getElementById('force-update-modal').style.display = 'flex';
                window.appUpdateLink = updateUrl;
            }
        }
    } catch (error) {
        console.log("خطأ في التحقق من التحديث:", error);
    }
}

function openUpdateLink() {
    if (window.appUpdateLink) {
        window.location.href = window.appUpdateLink;
    } else {
        alert("يرجى مراجعة قناة التطبيق لتحميل التحديث.");
    }
}
