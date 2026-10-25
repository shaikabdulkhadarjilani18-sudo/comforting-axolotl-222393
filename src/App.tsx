import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronDown, CircleHelp, Eye, EyeOff,
  Flower2, Leaf, LogOut, Menu, PackageCheck, ShieldCheck, Sprout, Sun, UserRound,
  Truck, Users, X,
} from "lucide-react";
import { useAuth } from "./auth/AuthProvider";
import { ApiError, apiRequest } from "./auth/api";
import { accountRoles, roleDestinations, type AccountRole, type Language, type Role } from "./auth/types";

const copy = {
  en: {
    signIn: "Sign in", getStarted: "Get started", dashboard: "Dashboard", logOut: "Log out",
    welcome: "A better harvest starts together.", intro: "A smarter food system begins at the source.",
    description: "FarmBridge brings local growers, neighborhood kitchens, and communities together — so good food travels further, and less goes to waste.",
    explore: "Explore the network", how: "How it works", trusted: "Grown with care. Shared with purpose.",
    join: "Join the food network", joinText: "One simple place for the people who grow, move, make, and share our food.",
    farm: "Growers", farmText: "Bring your harvest to the people who value it.",
    buyers: "Local kitchens", buyersText: "Source fresh, traceable food close to home.",
    community: "Community partners", communityText: "Help good food reach more tables.",
    loginTitle: "Welcome back", loginText: "Sign in to your FarmBridge account.",
    registerTitle: "Let’s grow together", registerText: "Create your account and find your place in the network.",
    email: "Email address", password: "Password", name: "Full name", role: "I am joining as",
    phone: "Phone number (optional)", business: "Farm or business name (optional)",
    confirmPassword: "Confirm password", forgot: "Forgot password?", noAccount: "New to FarmBridge?",
    haveAccount: "Already have an account?", createAccount: "Create account", signingIn: "Signing in…",
    creatingAccount: "Creating account…", forgotTitle: "Reset your password", forgotText: "We’ll email you a secure link to choose a new password.",
    sendLink: "Send reset link", sending: "Sending…", newPassword: "New password", updatePassword: "Update password",
    updating: "Updating…", backLogin: "Back to sign in",
    roleDashboard: "Your workspace", profile: "Account profile", loading: "Loading your account…",
    network: "Your local food network", quickStats: "Local growers|Food partners|Less waste",
    passwordHint: "At least 10 characters, with uppercase, lowercase, and a number.",
    lang: "తెలుగు",
    roleFarmer: "Farmer", roleBuyer: "Household Buyer", roleRetailer: "Retailer", roleRestaurant: "Restaurant",
    roleProcessor: "Food Processor", roleNgo: "NGO / Donation Partner", roleAdministrator: "Administrator",
    validationEmail: "Enter a valid email address.", validationName: "Enter your full name.",
    validationPassword: "At least 10 characters, with uppercase, lowercase, and a number.",
    validationConfirm: "Passwords do not match.", invalidCredentials: "Email or password is incorrect.",
    emailExists: "An account with this email already exists. Try signing in.",
    genericError: "Something went wrong. Please try again.",
    resetSent: "If an account exists for that email, a password reset link is on its way.",
    passwordChanged: "Your password has been updated. You can now sign in.",
    profileSaved: "Your profile has been saved.",
    validationPhone: "Enter a valid phone number.",
    validationBusiness: "Use 160 characters or fewer.",
    recoveryUnavailable: "Password recovery email is not configured on this server. Ask the site administrator to configure SMTP.",
    resetExpired: "This password reset link is invalid or has expired. Request a new link.",
    tooManyAttempts: "Too many attempts. Please wait a few minutes and try again.",
    serverUnavailable: "Could not reach the FarmBridge server. Start it with npm.cmd run dev.",
  },
  te: {
    signIn: "సైన్ ఇన్", getStarted: "ప్రారంభించండి", dashboard: "డ్యాష్‌బోర్డ్", logOut: "లాగ్ అవుట్",
    welcome: "మంచి పంటకు మనమంతా తోడుగా.", intro: "తెలివైన ఆహార వ్యవస్థ రైతు దగ్గరే మొదలవుతుంది.",
    description: "ఫార్మ్‌బ్రిడ్జ్ స్థానిక రైతులు, వంటశాలలు, సమాజాలను కలుపుతుంది — మంచి ఆహారం మరింత మందికి చేరేలా, వృథా తగ్గేలా.",
    explore: "నెట్‌వర్క్‌ను చూడండి", how: "ఇది ఎలా పనిచేస్తుంది", trusted: "శ్రద్ధతో పండింది. సదుద్దేశంతో పంచబడింది.",
    join: "ఆహార నెట్‌వర్క్‌లో చేరండి", joinText: "మన ఆహారాన్ని పండించే, తరలించే, తయారుచేసే, పంచే ప్రతి ఒక్కరికీ ఒక వేదిక.",
    farm: "రైతులు", farmText: "మీ పంటను విలువైన వారికి అందించండి.",
    buyers: "స్థానిక వంటశాలలు", buyersText: "దగ్గరలోనే తాజా ఆహారాన్ని పొందండి.",
    community: "సమాజ భాగస్వాములు", communityText: "మంచి ఆహారం మరిన్ని ఇళ్లకు చేరేలా చేయండి.",
    loginTitle: "తిరిగి స్వాగతం", loginText: "మీ ఫార్మ్‌బ్రిడ్జ్ ఖాతాలోకి సైన్ ఇన్ చేయండి.",
    registerTitle: "కలిసి అభివృద్ధి చెందుదాం", registerText: "ఖాతా సృష్టించి నెట్‌వర్క్‌లో మీ స్థానాన్ని పొందండి.",
    email: "ఈమెయిల్ చిరునామా", password: "పాస్‌వర్డ్", name: "పూర్తి పేరు", role: "మీరు చేరుతున్న పాత్ర",
    phone: "ఫోన్ నంబర్ (ఐచ్ఛికం)", business: "పొలం లేదా వ్యాపారం పేరు (ఐచ్ఛికం)",
    confirmPassword: "పాస్‌వర్డ్ నిర్ధారించండి", forgot: "పాస్‌వర్డ్ మర్చిపోయారా?", noAccount: "ఫార్మ్‌బ్రిడ్జ్‌లో కొత్తవారా?",
    haveAccount: "ఇప్పటికే ఖాతా ఉందా?", createAccount: "ఖాతా సృష్టించండి", signingIn: "సైన్ ఇన్ అవుతోంది…",
    creatingAccount: "ఖాతా సృష్టిస్తోంది…", forgotTitle: "పాస్‌వర్డ్ రీసెట్", forgotText: "కొత్త పాస్‌వర్డ్ కోసం సురక్షిత లింక్‌ను ఈమెయిల్ చేస్తాము.",
    sendLink: "రీసెట్ లింక్ పంపండి", sending: "పంపుతోంది…", newPassword: "కొత్త పాస్‌వర్డ్", updatePassword: "పాస్‌వర్డ్ మార్చండి",
    updating: "మారుస్తోంది…", backLogin: "సైన్ ఇన్‌కు తిరిగి వెళ్లండి",
    roleDashboard: "మీ కార్యస్థలం", profile: "ఖాతా వివరాలు", loading: "మీ ఖాతా లోడ్ అవుతోంది…",
    network: "మీ స్థానిక ఆహార నెట్‌వర్క్", quickStats: "స్థానిక రైతులు|ఆహార భాగస్వాములు|తక్కువ వృథా",
    passwordHint: "కనీసం 10 అక్షరాలు; పెద్ద, చిన్న అక్షరం మరియు ఒక సంఖ్య ఉండాలి.",
    lang: "English",
    roleFarmer: "రైతు", roleBuyer: "గృహ వినియోగదారు", roleRetailer: "చిల్లర వ్యాపారి", roleRestaurant: "రెస్టారెంట్",
    roleProcessor: "ఆహార ప్రాసెసర్", roleNgo: "స్వచ్ఛంద సంస్థ / విరాళ భాగస్వామి", roleAdministrator: "నిర్వాహకుడు",
    validationEmail: "సరైన ఈమెయిల్ చిరునామా నమోదు చేయండి.", validationName: "మీ పూర్తి పేరు నమోదు చేయండి.",
    validationPassword: "కనీసం 10 అక్షరాలు; పెద్ద, చిన్న అక్షరం మరియు ఒక సంఖ్య ఉండాలి.",
    validationConfirm: "పాస్‌వర్డ్‌లు సరిపోలడం లేదు.", invalidCredentials: "ఈమెయిల్ లేదా పాస్‌వర్డ్ తప్పు.",
    emailExists: "ఈ ఈమెయిల్‌తో ఖాతా ఇప్పటికే ఉంది. సైన్ ఇన్ చేయండి.",
    genericError: "ఏదో సమస్య వచ్చింది. మళ్లీ ప్రయత్నించండి.",
    resetSent: "ఈ ఈమెయిల్‌కు ఖాతా ఉంటే, పాస్‌వర్డ్ రీసెట్ లింక్ పంపబడుతుంది.",
    passwordChanged: "మీ పాస్‌వర్డ్ మార్చబడింది. ఇప్పుడు సైన్ ఇన్ చేయవచ్చు.",
    profileSaved: "మీ ప్రొఫైల్ సేవ్ చేయబడింది.",
    validationPhone: "సరైన ఫోన్ నంబర్ నమోదు చేయండి.",
    validationBusiness: "160 అక్షరాలు లేదా అంతకంటే తక్కువగా నమోదు చేయండి.",
    recoveryUnavailable: "పాస్‌వర్డ్ రికవరీ ఈమెయిల్ ఈ సర్వర్‌లో కాన్ఫిగర్ కాలేదు. SMTP సెటప్ కోసం నిర్వాహకుడిని సంప్రదించండి.",
    resetExpired: "ఈ పాస్‌వర్డ్ రీసెట్ లింక్ చెల్లదు లేదా గడువు ముగిసింది. కొత్త లింక్‌ను అభ్యర్థించండి.",
    tooManyAttempts: "చాలా ప్రయత్నాలు జరిగాయి. కొన్ని నిమిషాలు వేచి మళ్లీ ప్రయత్నించండి.",
    serverUnavailable: "ఫార్మ్‌బ్రిడ్జ్ సర్వర్‌ను చేరుకోలేకపోయాము. npm.cmd run dev తో ప్రారంభించండి.",
  },
} satisfies Record<Language, Record<string, string | string[]>>;

type CopyKey = keyof typeof copy.en;
type Translator = (key: CopyKey) => string;
const LanguageContext = createContext<Translator | null>(null);
const roleCopyKeys: Record<Role, CopyKey> = {
  farmer: "roleFarmer", buyer: "roleBuyer", retailer: "roleRetailer", restaurant: "roleRestaurant",
  processor: "roleProcessor", ngo: "roleNgo", administrator: "roleAdministrator",
};
const roleLabel = (role: Role, t: Translator) => t(roleCopyKeys[role]);

function useCopy() {
  const t = useContext(LanguageContext);
  if (!t) throw new Error("Language context is unavailable.");
  return t;
}

function App() {
  const [language, setLanguage] = useState<Language>(() =>
    localStorage.getItem("farmbridge-language") === "te" ? "te" : "en",
  );
  const t: Translator = (key) => copy[language][key];
  const changeLanguage = (next: Language) => {
    localStorage.setItem("farmbridge-language", next);
    setLanguage(next);
  };
  return (
    <LanguageContext.Provider value={t}>
      <Routes>
        <Route path="/" element={<Landing language={language} onLanguage={changeLanguage} />} />
        <Route path="/login" element={<AuthPage mode="login" language={language} onLanguage={changeLanguage} />} />
        <Route path="/register" element={<AuthPage mode="register" language={language} onLanguage={changeLanguage} />} />
        <Route path="/forgot-password" element={<AuthPage mode="forgot" language={language} onLanguage={changeLanguage} />} />
        <Route path="/reset-password" element={<AuthPage mode="reset" language={language} onLanguage={changeLanguage} />} />
        <Route path="/auth/callback" element={<Navigate to="/" replace />} />
        <Route path="/dashboard/:role" element={<ProtectedDashboard language={language} onLanguage={changeLanguage} />} />
        <Route path="/admin" element={<ProtectedDashboard administrator language={language} onLanguage={changeLanguage} />} />
        <Route path="/profile" element={<ProtectedDashboard profilePage language={language} onLanguage={changeLanguage} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </LanguageContext.Provider>
  );
}

type HeaderProps = { language: Language; onLanguage: (language: Language) => void; minimal?: boolean };

function Header({ language, onLanguage, minimal = false }: HeaderProps) {
  const t = useCopy();
  const { user, profile, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const logout = async () => {
    try {
      await signOut(() => navigate("/", { replace: true }));
    } catch (error) {
      console.error("Sign out failed.", error);
      window.alert("We could not sign you out. Please try again.");
    }
  };
  return (
    <header className="site-header">
      <Link to="/" className="brand" aria-label="FarmBridge AI home">
        <span className="brand-mark"><Sprout size={21} strokeWidth={2.2} /></span>
        <span>farmbridge<span className="brand-ai">.ai</span></span>
      </Link>
      {!minimal && <nav className={`main-nav ${menuOpen ? "nav-open" : ""}`}>
        <a href="#how-it-works">{t("how")}</a>
        <a href="#community">{t("join")}</a>
        <button className="language-button" onClick={() => onLanguage(language === "en" ? "te" : "en")}>
          {t("lang")} <ChevronDown size={14} />
        </button>
        {user ? (
          <div className="nav-auth">
            <Link className="nav-dashboard" to={profile?.role ? roleDestinations[profile.role] : "/profile"}>{t("dashboard")} <ArrowUpRight size={15} /></Link>
            <Link className="nav-dashboard" to="/profile" aria-label={t("profile")}><UserRound size={15} /></Link>
            <button className="nav-logout" onClick={() => void logout()} aria-label={t("logOut")}><LogOut size={16} /></button>
          </div>
        ) : <div className="nav-auth">
          <Link className="nav-signin" to="/login">{t("signIn")}</Link>
          <Link className="button button-small" to="/register">{t("getStarted")} <ArrowRight size={15} /></Link>
        </div>}
      </nav>}
      {!minimal && <button className="mobile-menu" aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen(!menuOpen)}>
        {menuOpen ? <X size={21} /> : <Menu size={21} />}
      </button>}
    </header>
  );
}

function Landing({ language, onLanguage }: { language: Language; onLanguage: HeaderProps["onLanguage"] }) {
  const t = useCopy();
  const { user, profile } = useAuth();
  const destination = profile ? roleDestinations[profile.role] : "/profile";
  return (
    <div className="landing-page">
      <Header language={language} onLanguage={onLanguage} />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot" /> {t("network")}</div>
            <h1>{t("welcome").split(".")[0]}<span>.</span></h1>
            <h2>{t("intro")}</h2>
            <p>{t("description")}</p>
            <div className="hero-actions">
              <Link className="button" to={user ? destination : "/register"}>{user ? t("dashboard") : t("explore")} <ArrowRight size={17} /></Link>
              <a className="text-link" href="#how-it-works">{t("how")} <ArrowDown size={15} /></a>
            </div>
            <div className="hero-proof"><div className="avatar-stack"><span>R</span><span>A</span><span>S</span><span>+</span></div><span>{t("trusted")}</span></div>
          </div>
          <div className="hero-art" aria-label="Fresh produce from local farms">
            <img src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=85" alt="Fresh produce at a local market" />
            <div className="art-tag"><span className="tag-icon"><Leaf size={16} /></span><span><strong>Fresh from nearby</strong><small>Good food, closer to home</small></span><ArrowUpRight size={17} /></div>
            <div className="art-stamp"><Sprout size={19} /><span>LOCAL<br />MATTERS</span></div>
          </div>
          <div className="hero-bottom">
            <div className="hero-stats">{t("quickStats").split("|").map((stat, index) => <span key={stat}><b>{["01", "02", "03"][index]}</b>{stat}</span>)}</div>
            <span className="hero-scroll">SCROLL TO EXPLORE <ArrowDown size={14} /></span>
          </div>
        </section>
        <section id="how-it-works" className="how-section">
          <div className="section-heading"><span className="eyebrow">A healthier food system, together</span><h2>{t("join")}</h2><p>{t("joinText")}</p></div>
          <div className="role-cards">
            <RoleCard icon={<Sprout />} number="01" title={t("farm")} text={t("farmText")} to="/register?role=farmer" />
            <RoleCard icon={<PackageCheck />} number="02" title={t("buyers")} text={t("buyersText")} to="/register?role=buyer" />
            <RoleCard icon={<Users />} number="03" title={t("community")} text={t("communityText")} to="/register?role=ngo" />
          </div>
          <div id="community" className="community-banner"><div><span className="eyebrow">Better connections. Better outcomes.</span><h2>Good food deserves<br />a better journey.</h2></div><Link className="button button-light" to="/register">{t("getStarted")} <ArrowRight size={17} /></Link><div className="banner-leaf"><Flower2 size={112} /></div></div>
        </section>
      </main>
      <footer className="site-footer"><Link to="/" className="brand"><span className="brand-mark"><Sprout size={19} /></span><span>farmbridge<span className="brand-ai">.ai</span></span></Link><span>© {new Date().getFullYear()} FarmBridge AI</span><span>Rooted in community. Growing with purpose.</span></footer>
    </div>
  );
}

function RoleCard({ icon, number, title, text, to }: { icon: ReactNode; number: string; title: string; text: string; to: string }) {
  return <Link className="role-card" to={to}><div className="role-card-top"><span className="role-icon">{icon}</span><span className="role-number">{number}</span></div><h3>{title}</h3><p>{text}</p><span className="role-link">Find your place <ArrowUpRight size={15} /></span></Link>;
}

function AuthShell({ language, onLanguage, children, sideNote }: HeaderProps & { children: ReactNode; sideNote: string }) {
  const t = useCopy();
  return <div className="auth-page"><Header language={language} onLanguage={onLanguage} minimal /><main className="auth-main">
    <aside className="auth-aside"><div className="aside-orbit orbit-one" /><div className="aside-orbit orbit-two" /><div className="aside-content"><span className="eyebrow"><Sprout size={15} /> FARM TOGETHER</span><h1>Rooted in trust.<br /><span>Growing forward.</span></h1><p>{sideNote}</p><div className="aside-points"><span><Check size={16} /> One connected local food network</span><span><Check size={16} /> Built around people and place</span></div><div className="aside-sun"><Sun size={36} /></div></div></aside>
    <section className="auth-panel"><div className="auth-form-wrap">{children}</div><p className="auth-footnote"><ShieldCheck size={15} /> Your information is protected by secure authentication.</p></section>
  </main><footer className="auth-footer"><span>© {new Date().getFullYear()} FarmBridge AI</span><button onClick={() => onLanguage(language === "en" ? "te" : "en")}>{t("lang")}</button></footer></div>;
}

function AuthPage({ mode, language, onLanguage }: { mode: "login" | "register" | "forgot" | "reset"; language: Language; onLanguage: HeaderProps["onLanguage"] }) {
  const t = useCopy();
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const returnTo = safeReturnTo(params.get("returnTo"));
  const suggestedRole = params.get("role");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const resetToken = params.get("token") ?? "";

  useEffect(() => {
    if (user && profile && mode !== "reset") navigate(returnTo || roleDestinations[profile.role], { replace: true });
  }, [user, profile, mode, returnTo, navigate]);

  const friendlyError = (err: unknown) => {
    const text = err instanceof Error ? err.message : "";
    if (err instanceof ApiError) {
      if (err.code === "INVALID_CREDENTIALS") return t("invalidCredentials");
      if (err.code === "EMAIL_EXISTS") return t("emailExists");
      if (err.code === "INVALID_EMAIL") return t("validationEmail");
      if (err.code === "INVALID_PASSWORD") return t("validationPassword");
      if (err.code === "EMAIL_NOT_CONFIGURED") return t("recoveryUnavailable");
      if (err.code === "INVALID_RESET_TOKEN") return t("resetExpired");
      if (err.code === "RATE_LIMITED") return t("tooManyAttempts");
      if (err.code === "SERVER_UNAVAILABLE") return t("serverUnavailable");
    }
    if (/email or password is incorrect/i.test(text)) return t("invalidCredentials");
    if (/already registered|already been registered/i.test(text)) return t("emailExists");
    return text || t("genericError");
  };
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setFieldErrors({});
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const validation: Record<string, string> = {};
    if (mode !== "reset" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) validation.email = t("validationEmail");
    if (mode === "register") {
      const fullName = String(form.get("fullName") ?? "").trim();
      const confirmPassword = String(form.get("confirmPassword") ?? "");
      if (fullName.length < 2 || fullName.length > 120) validation.fullName = t("validationName");
      const phone = String(form.get("phone") ?? "").trim();
      const businessName = String(form.get("businessName") ?? "").trim();
      if (phone && !/^\+?[0-9\s().-]{7,32}$/.test(phone)) validation.phone = t("validationPhone");
      if (businessName.length > 160) validation.businessName = t("validationBusiness");
      if (password.length < 10 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) validation.password = t("validationPassword");
      if (password !== confirmPassword) validation.confirmPassword = t("validationConfirm");
    }
    if (mode === "reset" && (password.length < 10 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password))) validation.password = t("validationPassword");
    if (Object.keys(validation).length) {
      setFieldErrors(validation);
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        const result = await apiRequest<{ profile: { role: Role } }>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        await refreshProfile();
        navigate(returnTo || roleDestinations[result.profile.role], { replace: true });
      } else if (mode === "register") {
        const roleValue = String(form.get("role") ?? "farmer");
        if (!accountRoles.includes(roleValue as AccountRole)) throw new Error("Choose a valid account type.");
        const result = await apiRequest<{ profile: { role: Role } }>("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({
            email,
            password,
            fullName: String(form.get("fullName") ?? "").trim(),
            phone: String(form.get("phone") ?? "").trim(),
            role: roleValue,
            preferredLanguage: language,
            businessName: String(form.get("businessName") ?? "").trim(),
          }),
        });
        await refreshProfile();
        navigate(returnTo || roleDestinations[result.profile.role], { replace: true });
      } else if (mode === "forgot") {
        await apiRequest<{ message: string }>("/api/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify({ email }),
        });
        setMessage(t("resetSent"));
      } else {
        await apiRequest<{ message: string }>("/api/auth/reset-password", {
          method: "POST",
          body: JSON.stringify({ token: resetToken, password }),
        });
        setMessage(t("passwordChanged"));
        window.setTimeout(() => navigate("/login", { replace: true }), 1400);
      }
    } catch (err) {
      console.error("Authentication request failed.", err);
      setError(err instanceof ApiError && err.code === "EMAIL_NOT_CONFIGURED" ? t("recoveryUnavailable") : friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  if (mode !== "reset" && authLoading) return <LoadingScreen />;
  if (user && profile && mode !== "reset") return <LoadingScreen />;
  const titles = { login: [t("loginTitle"), t("loginText")], register: [t("registerTitle"), t("registerText")], forgot: [t("forgotTitle"), t("forgotText")], reset: [t("newPassword"), "Choose a strong password you haven’t used before."] };
  const [title, subtitle] = titles[mode];
  const fieldsEmail = mode !== "reset";
  return <AuthShell language={language} onLanguage={onLanguage} sideNote="Where local food finds its way — from the hands that grow it to the people who need it.">
    <div className="form-heading"><span className="eyebrow"><Leaf size={14} /> YOUR FARMbridge</span><h2>{title}</h2><p>{subtitle}</p></div>
    {message && <div className="notice notice-success" role="status"><Check size={18} /><div>{message}</div></div>}
    {error && <div className="notice notice-error" role="alert"><CircleHelp size={18} /><span>{error}</span></div>}
    <form className="auth-form" onSubmit={(event) => void onSubmit(event)} noValidate>
      {fieldsEmail && <FormField label={t("email")} error={fieldErrors.email}><input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></FormField>}
      {mode === "register" && <>
        <FormField label={t("name")} error={fieldErrors.fullName}><input name="fullName" autoComplete="name" required placeholder="Your name" /></FormField>
        <FormField label={t("role")}><select name="role" defaultValue={suggestedRole && accountRoles.includes(suggestedRole as AccountRole) ? suggestedRole : "farmer"}>{accountRoles.map((role) => <option key={role} value={role}>{roleLabel(role, t)}</option>)}</select></FormField>
        <FormField label={t("phone")} error={fieldErrors.phone}><input name="phone" type="tel" autoComplete="tel" maxLength={32} placeholder="+91 98765 43210" /></FormField>
        <FormField label={t("business")} error={fieldErrors.businessName}><input name="businessName" maxLength={160} placeholder="e.g. Green Valley Farm" /></FormField>
      </>}
      {mode !== "forgot" && <FormField label={mode === "reset" ? t("newPassword") : t("password")} error={fieldErrors.password}>
        <div className="password-wrap"><input name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} required placeholder="••••••••••" /><button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
        {(mode === "register" || mode === "reset") && <small className="field-hint">{t("passwordHint")}</small>}
      </FormField>}
      {mode === "register" && <FormField label={t("confirmPassword")} error={fieldErrors.confirmPassword}><div className="password-wrap"><input name="confirmPassword" type={showConfirm ? "text" : "password"} autoComplete="new-password" required placeholder="••••••••••" /><button type="button" className="password-toggle" onClick={() => setShowConfirm(!showConfirm)} aria-label={showConfirm ? "Hide password" : "Show password"}>{showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></FormField>}
      {mode === "login" && <div className="forgot-row"><span /><Link to="/forgot-password">{t("forgot")}</Link></div>}
      <button className="button auth-submit" disabled={loading} type="submit">{loading ? <>{mode === "login" ? t("signingIn") : mode === "register" ? t("creatingAccount") : mode === "forgot" ? t("sending") : t("updating")}</> : <>{mode === "login" ? t("signIn") : mode === "register" ? t("createAccount") : mode === "forgot" ? t("sendLink") : t("updatePassword")} <ArrowRight size={17} /></>}</button>
    </form>
    <div className="auth-switch">{mode === "login" ? <>{t("noAccount")} <Link to="/register">{t("getStarted")}</Link></> : mode === "register" ? <>{t("haveAccount")} <Link to="/login">{t("signIn")}</Link></> : <Link to="/login">{t("backLogin")}</Link>}</div>
  </AuthShell>;
}

function FormField({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return <label className={`form-field ${error ? "has-error" : ""}`}><span>{label}</span>{children}{error && <small className="field-error">{error}</small>}</label>;
}

function safeReturnTo(destination: string | null) {
  if (!destination || !destination.startsWith("/") || destination.startsWith("//") || destination.includes("\\")) return "";
  try {
    const parsed = new URL(destination, window.location.origin);
    if (parsed.origin !== window.location.origin) return "";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "";
  }
}

function LoadingScreen() {
  const t = useCopy();
  return <div className="loading-screen"><span className="loading-mark"><Sprout size={23} /></span><span>{t("loading")}</span></div>;
}

function ProtectedDashboard({ administrator = false, profilePage = false, language, onLanguage }: { administrator?: boolean; profilePage?: boolean; language: Language; onLanguage: HeaderProps["onLanguage"] }) {
  const t = useCopy();
  const { user, profile, loading, profileError, refreshProfile, signOut } = useAuth();
  const { role } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [logoutPending, setLogoutPending] = useState(false);
  useEffect(() => {
    if (!loading && !user) {
      const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
      navigate(`/login?returnTo=${returnTo}`, { replace: true });
    }
  }, [loading, user, location.pathname, location.search, navigate]);

  if (loading || (user && !profile && !profileError)) return <LoadingScreen />;
  if (!user) return <LoadingScreen />;
  if (profileError) return <div className="loading-screen"><p>{profileError}</p><Link to="/login">{t("backLogin")}</Link></div>;
  if (!profile) return <div className="loading-screen"><p>Your account profile is unavailable. Contact support for help.</p></div>;
  const target = administrator ? "/admin" : profilePage ? "/profile" : role && Object.hasOwn(roleDestinations, role) ? roleDestinations[role as Role] : "";
  if (!target) return <Navigate to={roleDestinations[profile.role]} replace />;
  if (target !== roleDestinations[profile.role] && !(profilePage && target === "/profile") && !(administrator && profile.role === "administrator")) {
    return <Navigate to={roleDestinations[profile.role]} replace />;
  }
  const leave = async () => {
    setLogoutPending(true);
    try {
      await signOut(() => navigate("/", { replace: true }));
    } catch (error) {
      console.error("Sign out failed.", error);
      window.alert("We could not sign you out. Please try again.");
      setLogoutPending(false);
    }
  };
  return <div className="dashboard-page">
    <Header language={language} onLanguage={onLanguage} />
    <main className="dashboard-main"><div className="dashboard-welcome"><div><span className="eyebrow"><Sprout size={14} /> {t("roleDashboard")}</span><h1>Good to have you here, {profile.full_name.split(" ")[0]}.</h1><p>Your FarmBridge network is ready when you are.</p></div><button className="button button-outline" onClick={() => void leave()} disabled={logoutPending}><LogOut size={16} /> {logoutPending ? "Signing out…" : t("logOut")}</button></div>
      <section className="dashboard-card"><div className="dashboard-card-icon"><Leaf size={24} /></div><span className="eyebrow">YOUR FARMbridge WORKSPACE</span><h2>{profilePage ? t("profile") : roleLabel(profile.role, t)}</h2><p>{profile.farm_or_business_name || "Your local food connections start here."}</p><div className="profile-facts"><span><b>Name</b>{profile.full_name}</span><span><b>Email</b>{user.email}</span><span><b>Account type</b>{roleLabel(profile.role, t)}</span><span><b>Phone</b>{profile.phone || "Not added"}</span></div></section>
      {profilePage && <ProfileSettings profile={profile} onSaved={refreshProfile} />}
      <div className="dashboard-cards"><article><span><Truck size={19} /></span><h3>Connect locally</h3><p>Discover nearby partners and opportunities for your food network.</p></article><article><span><PackageCheck size={19} /></span><h3>Keep things moving</h3><p>Make local sourcing and sharing a more dependable journey.</p></article><article><span><ShieldCheck size={19} /></span><h3>Built on trust</h3><p>Your account and profile are protected by secure access controls.</p></article></div>
      <Link className="back-home" to="/">← Back to FarmBridge home</Link>
    </main>
  </div>;
}

function ProfileSettings({ profile, onSaved }: { profile: NonNullable<ReturnType<typeof useAuth>["profile"]>; onSaved: () => Promise<void> }) {
  const t = useCopy();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");
    const values = new FormData(event.currentTarget);
    const fullName = String(values.get("fullName") ?? "").trim();
    const phone = String(values.get("phone") ?? "").trim();
    const business = String(values.get("businessName") ?? "").trim();
    if (fullName.length < 2 || fullName.length > 120) {
      setError("Name must be between 2 and 120 characters.");
      return;
    }
    if (phone.length > 32 || business.length > 160) {
      setError("Please check the length of your phone number or business name.");
      return;
    }
    setSaving(true);
    try {
      await apiRequest("/api/profile", {
        method: "PUT",
        body: JSON.stringify({ fullName, phone, businessName: business }),
      });
      await onSaved();
      setMessage(t("profileSaved"));
    } catch (saveError) {
      console.error("Could not save profile settings.", saveError);
      setError("We could not save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  return <section className="profile-settings">
    <div><span className="eyebrow">ACCOUNT SETTINGS</span><h2>Edit your profile</h2><p>Your account type is managed securely and can’t be changed here.</p></div>
    {message && <div className="notice notice-success" role="status"><Check size={17} />{message}</div>}
    {error && <div className="notice notice-error" role="alert"><CircleHelp size={17} />{error}</div>}
    <form className="profile-edit-form" onSubmit={(event) => void saveProfile(event)}>
      <FormField label="Full name"><input name="fullName" defaultValue={profile.full_name} maxLength={120} required /></FormField>
      <FormField label="Phone number"><input name="phone" type="tel" defaultValue={profile.phone ?? ""} maxLength={32} /></FormField>
      <FormField label="Farm or business name"><input name="businessName" defaultValue={profile.farm_or_business_name ?? ""} maxLength={160} /></FormField>
      <button className="button" disabled={saving} type="submit">{saving ? "Saving…" : "Save changes"} <Check size={16} /></button>
    </form>
  </section>;
}

function NotFound() {
  return <main className="not-found"><Sprout size={36} /><span className="eyebrow">PAGE NOT FOUND</span><h1>This path has gone off the trail.</h1><p>Let’s get you back to the FarmBridge network.</p><Link className="button" to="/">Back home <ArrowRight size={16} /></Link></main>;
}

export default App;
