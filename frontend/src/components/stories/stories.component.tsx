import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import jsPDF from "jspdf";
import StoriesViewComponent, { IStories } from "./stories.view.component";
import { Link } from "react-router-dom";
import { getUserInfo, isLoggedIn } from "../../services/auth.service";
import { getRequestLimit, getWordCount, prompts, STORY_TEMPLATES } from "./stories.utils";
import CharacterPortrait from "../character-portrait/CharacterPortrait";
import {
  useGenerateFreeModelMutation,
  useGenerateModelMutation,
  useGetUsageQuery,
} from "../../redux/apis/ai.model.api";
import { UpgradeModal } from "./UpgradeModal";
import toast, { Toaster } from "react-hot-toast";
import { SubmitHandler, useForm } from "react-hook-form";
import { useGetProfileInfoQuery } from "../../redux/apis/user.api";
import { useGetCharactersQuery, useSaveCharacterMutation } from "../../redux/apis/character.api";
import { getErrorMessage } from "../../error/error.message";
import useKeyboardShortcuts from "../../hooks/useKeyboardShortcuts";
import StoryGeneratingAnimation from "../loading/story-generating-animation.component";
// import { useDebounce } from "../../hooks/useDebounce";
// import ConfirmDialog from "./ConfirmDialog";
// import {
//   clearStoryDraft,
//   loadStoryDraft,
//   saveStoryDraft,
//   type StoryDraftData,
// } from "../../utils/story-draft";
// import { useCreatePostMutation, useDeletePostMutation } from "../../redux/apis/post.api";
// import { useRecentPrompts } from "../../hooks/useRecentPrompts";

// Types and constants
type Inputs = {
  prompt: string;
};

const MAX_PROMPT_LENGTH = 2000;
const WARN_THRESHOLD = 0.85;
const DANGER_THRESHOLD = 0.95;
const lengths = ["short", "medium", "long"] as const;

const soundtrackMap: Record<string, string> = {
  "≡ƒºÖ Fantasy": "/audio/fantasy.mp3",
  "≡ƒÿ▒ Horror": "/audio/horror.mp3",
  "≡ƒÆò Romance": "/audio/romance.mp3",
  "≡ƒÄ¡ Drama": "/audio/drama.mp3",
  "≡ƒÿé Comedy": "/audio/comedy.mp3",
  "≡ƒÜÇ Sci-Fi": "/audio/sci-fi.mp3",
  "≡ƒöì Mystery": "/audio/mystery.mp3",
  "≡ƒîƒ Adventure": "/audio/adventure.mp3"
};


const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "hi", name: "Hindi" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "pt", name: "Portuguese" },
  { code: "de", name: "German" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "bn", name: "Bengali" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "mr", name: "Marathi" },
];

const GENRES = [
  { value: "🎭 Drama", icon: "🎭", name: "Drama" },
  { value: "😂 Comedy", icon: "😂", name: "Comedy" },
  { value: "😱 Horror", icon: "😱", name: "Horror" },
  { value: "💕 Romance", icon: "💕", name: "Romance" },
  { value: "🚀 Sci-Fi", icon: "🚀", name: "Sci-Fi" },
  { value: "🧙 Fantasy", icon: "🧙", name: "Fantasy" },
  { value: "🔍 Mystery", icon: "🔍", name: "Mystery" },
  { value: "🌟 Adventure", icon: "🌟", name: "Adventure" },
  { value: "🗺️ Adventurous", icon: "🗺️", name: "Adventurous" },
  { value: "🤖 Tech / Sci-Fi", icon: "🤖", name: "Tech / Sci-Fi" },
  { value: "💖 Romance / Love", icon: "💖", name: "Romance / Love" },
] as const;

// type GenreName = (typeof GENRES)[number]["name"];

const TONES = [
  {
    label: "Dark",
    emoji: "≡ƒîæ",
    activeClass: "bg-gray-700 text-gray-100 border-gray-500 shadow-gray-700/40",
    inactiveClass: "bg-white/5 text-gray-400 border-transparent hover:bg-white/10 hover:text-gray-200",
  },
  {
    label: "Whimsical",
    emoji: "≡ƒîê",
    activeClass: "bg-sky-500/20 text-sky-300 border-sky-500/60 shadow-sky-500/20",
    inactiveClass: "bg-white/5 text-gray-400 border-transparent hover:bg-white/10 hover:text-gray-200",
  },
  {
    label: "Dramatic",
    emoji: "≡ƒÄ¼",
    activeClass: "bg-red-500/20 text-red-300 border-red-500/60 shadow-red-500/20",
    inactiveClass: "bg-white/5 text-gray-400 border-transparent hover:bg-white/10 hover:text-gray-200",
  },
  {
    label: "Humorous",
    emoji: "≡ƒÿä",
    activeClass: "bg-yellow-500/20 text-yellow-300 border-yellow-500/60 shadow-yellow-500/20",
    inactiveClass: "bg-white/5 text-gray-400 border-transparent hover:bg-white/10 hover:text-gray-200",
  },
  {
    label: "Suspenseful",
    emoji: "≡ƒÿ¿",
    activeClass: "bg-orange-500/20 text-orange-300 border-orange-500/60 shadow-orange-500/20",
    inactiveClass: "bg-white/5 text-gray-400 border-transparent hover:bg-white/10 hover:text-gray-200",
  },
  {
    label: "Heartwarming",
    emoji: "≡ƒÑ░",
    activeClass: "bg-pink-500/20 text-pink-300 border-pink-500/60 shadow-pink-500/20",
    inactiveClass: "bg-white/5 text-gray-400 border-transparent hover:bg-white/10 hover:text-gray-200",
  },
] as const;

type ToneLabel = (typeof TONES)[number]["label"];

// UI Text translations
const UI_TEXT: Record<string, Record<string, string>> = {
  English: {
    back: "BACK",
    freeAccess: "Free access for 3 requests",
    login: "Login",
    forMore: "for more!",
    perMonth: "Per Month",
    upgrade: "Upgrade",
    monthlyRequests: "This month request",
    totalPosts: "Total posts",
    titleStart: "Turn Your Ideas Into",
    titleAccent: "Amazing Stories!",
    length: "Length",
    language: "Language",
    short: "Short",
    medium: "Medium",
    long: "Long",
    promptPlaceholder: "Every great story begins with a single idea. What's yours?",
    keyboardTip: "Keyboard tip:",
    press: "Press",
    toGenerate: "to generate",
    alsoWorks: "also works",
    forNewLine: "for new line",
    generating: "Generating...",
    generate: "Generate",
    examples: "Here are some example prompts you can refer to:-",
    selectPrompt: "Select a prompt",
    characterLimit: "Character limit reached - generate is disabled",
    charactersRemaining: "characters remaining",
    shortcuts: "Keyboard Shortcuts",
    openHelp: "Open help",
    closeHelp: "Close help",
    focusPrompt: "Focus prompt",
    generateStory: "Generate story",
    publishStory: "Publish story",
    close: "Close",
    freeLimitReached: "Free Limit Reached",
    freeLimitMessage: "You've used all 3 free story generations. Login to continue creating more stories.",
    continueBrowsing: "Continue Browsing",
    recentPrompts: "Recent Prompts",
    usePrompt: "Use",
    delete: "Delete",
    clearAll: "Clear All",
    noRecentPrompts: "No recent prompts yet",
  },
  // Add other language translations here...
};

// Helper function - define before using it
const loadStoryDraft = () => {
  try {
    const draft = localStorage.getItem("storyDraft");
    if (draft) {
      return JSON.parse(draft);
    }
  } catch (error) {
    console.warn("Failed to load story draft:", error);
  }
  return null;
};

// Tone Picker Component
const TonePicker: React.FC<{ selected: ToneLabel | ""; onChange: (tone: ToneLabel | "") => void }> = 
  React.memo(({ selected, onChange }) => {
    return (
      <div className="flex flex-wrap gap-2 mb-3">
        <span className="w-full text-xs text-gray-400 mb-1">🎭 Tone:</span>
        {TONES.map((tone) => {
          const isActive = selected === tone.label;
          return (
            <button
              key={tone.label}
              type="button"
              onClick={() => onChange(isActive ? "" : tone.label)}
              aria-pressed={isActive}
              title={isActive ? `Remove "${tone.label}" tone` : `Set tone to "${tone.label}"`}
              className={`
                px-3 py-1 rounded-full text-xs font-medium border transition-all duration-200
                ${isActive
                  ? `${tone.activeClass} shadow-md scale-105`
                  : tone.inactiveClass
                }
              `}
            >
              {tone.emoji} {tone.label}
            </button>
          );
        })}
      </div>
    );
  });

// Main StoriesComponent
const StoriesComponent: React.FC = () => {
  // const location = useLocation();
  // const navigate = useNavigate();
  const { register, handleSubmit, reset, setValue } = useForm<Inputs>();
  
  // State declarations
  const [stories, setStories] = useState<IStories[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  // Removed unused setSelectedStory
  // const [selectedStory] = useState<IStories | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string>("");
  const [selectedLength, setSelectedLength] = useState<string>("medium");
  const [selectedTone, setSelectedTone] = useState<ToneLabel | "">("");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("English");
  const [textareaValue, setTextareaValue] = useState<string>("");
  const [selectedPrompt, setSelectedPrompt] = useState<string>("");
  const [showHelpModal, setShowHelpModal] = useState(false);
  return segments;
};

interface ICharacter {
  id: string;
  name: string;
  role: string;
  personality: string;
}

const TemplateSelectionScreen: React.FC<{
  onSelectTemplate: (template: any) => void;
  onStartBlank: () => void;
}> = ({ onSelectTemplate, onStartBlank }) => {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-extrabold text-slate-100 mb-4">Start from Template</h2>
        <p className="text-slate-400 max-w-2xl mx-auto">Choose a genre-specific template to kickstart your story, or start with a blank canvas.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {STORY_TEMPLATES.map((template) => (
          <div key={template.id} className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-indigo-500 transition-colors cursor-pointer" onClick={() => onSelectTemplate(template)}>
            <div className="text-sm text-indigo-400 font-semibold mb-2">{template.genre}</div>
            <h3 className="text-xl font-bold text-slate-200 mb-3">{template.templateName}</h3>
            <p className="text-slate-400 text-sm mb-4">{template.openingHook}</p>
            <div className="text-xs text-slate-500">
              Length: <span className="capitalize">{template.length}</span> &bull; {template.characters.length} characters
            </div>
          </div>
        ))}
      </div>
      <div className="text-center">
        <button onClick={onStartBlank} className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-semibold transition-colors">
          Start with Blank Canvas
        </button>
      </div>
    </div>
  );
};


const StoriesViewComponent: React.FC<StoriesComponentProps> = ({
  stories,
  isLogin,
  setStories,
  isLoading,
  onPublishSuccess,
}) => {
  const location = useLocation();
const navigate = useNavigate();
const { register, handleSubmit, reset, setValue, formState : {isSubmitting} } = useForm<Inputs>();
  const [stories, setStories] = useState<IStories[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const { data } = useGetProfileInfoQuery(undefined);
  const userRole = getUserInfo();
  const subscriptionType = (userRole?.subscriptionType as string) || "free";
  const login = isLoggedIn();
  const [showUpgradeModal, setShowUpgradeModal] = useState<boolean>(false);
  const { data: usageData, refetch: refetchUsage } = useGetUsageQuery(undefined, { skip: !login });
  const [generateModel] = useGenerateModelMutation();
  const [generateFreeModel] = useGenerateFreeModelMutation();
  const [selectedPrompt, setSelectedPrompt] = useState<string>("");
  const [showHelpModal, setShowHelpModal] = useState(false);
const [selectedGenre, setSelectedGenre] = useState<string>("");
const [selectedLength, setSelectedLength] = useState<string>("medium");
const [textareaValue, setTextareaValue] = useState<string>("");
const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
const { data: rosterData } = useGetCharactersQuery(undefined, { skip: !login });
const rosterCharacters = rosterData?.data || [];
const [saveCharacter, { isLoading: isSavingCharacter }] = useSaveCharacterMutation();
const [selectedRosterCharacterId, setSelectedRosterCharacterId] =
  useState<string>("");
const selectedRosterCharacter = rosterCharacters.find(
  (character) => character._id === selectedRosterCharacterId
);

const handleSaveToRoster = async (char: ICharacter) => {
  try {
    await saveCharacter({
      name: char.name,
      role: char.role,
      personality: char.personality
    }).unwrap();
    toast.success("Character saved to roster!");
  } catch (error) {
    toast.error("Failed to save character.");
  }
};

const handleLoadFromRoster = (
  charId: string,
  rosterCharId: string
) => {
  const rosterChar = rosterCharacters.find(
    (character) => character._id === rosterCharId
  );

  if (!rosterChar) return;

  setSelectedRosterCharacterId(rosterCharId);

  if (typeof setCharacters === "function") {
    setCharacters((prev: ICharacter[]) =>
      prev.map((character) =>
        character.id === charId
          ? {
              ...character,
              name: rosterChar.name,
              role: rosterChar.role || "",
              personality: rosterChar.personality,
            }
          : character
      )
    );
  }
};
const dropdownRef = useRef<HTMLDivElement>(null);
const inputRef = useRef<HTMLTextAreaElement>(null);
const [guestRequestCount, setGuestRequestCount] = useState<number>(() =>
  parseInt(localStorage.getItem("guestRequestCount") || "0", 10),
);
const [showLimitModal, setShowLimitModal] = useState<boolean>(false);

useEffect(() => {
  window.scrollTo({ top: 0, behavior: "smooth" });
}, []);

useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(event.target as Node)
    ) {
      setIsDropdownOpen(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      setIsDropdownOpen(false);

  const [selectedGenre, setSelectedGenre] = useState<string>(

    draft?.genre
      ? (GENRES.find((g) => g.name === draft.genre || g.value === draft.genre)?.value ?? "≡ƒºÖ Fantasy")
      : "≡ƒºÖ Fantasy",
  );

  const [selectedLength, setSelectedLength] = useState<string>(draft?.length || "medium");
  const [selectedTone, setSelectedTone] = useState<ToneLabel | "">(draft?.tone || "Dramatic");
  const [selectedAudience, setSelectedAudience] = useState<string>("General Audience");
  const [textareaValue, setTextareaValue] = useState<string>(() => {
    return location.state?.prompt || draft?.prompt || "";
  });

  const [showTemplateScreen, setShowTemplateScreen] = useState<boolean>(() => {
    return !location.state?.prompt && !draft?.prompt;
  });

  const handleSelectTemplate = (template: any) => {
    const fullPremise = `${template.premise}\n\nSuggested Plot Points:\n- ${template.plotPoints.join('\n- ')}`;
    setTextareaValue(fullPremise);
    setSelectedGenre(template.genre);
    setSelectedLength(template.length);
    setCharacters(template.characters);
    setShowTemplateScreen(false);
  };

  const handleStartBlank = () => {
    setShowTemplateScreen(false);
  };


  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState<boolean>(false);
  const [guestRequestCount, setGuestRequestCount] = useState<number>(() =>
    parseInt(localStorage.getItem("guestRequestCount") || "0", 10)
  );
  const [showLimitModal, setShowLimitModal] = useState<boolean>(false);
  // Removed unused setDraftStatus
  // const [draftStatus] = useState<string>("");
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const languageDropdownRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const login = isLoggedIn();
  const { data: profile } = useGetProfileInfoQuery(undefined, { skip: !login });
  const userRole = getUserInfo();
  const subscriptionType = (userRole?.subscriptionType as string) || "free";
  
  const [generateModel] = useGenerateModelMutation();
  const [generateFreeModel] = useGenerateFreeModelMutation();
  // const [createPost] = useCreatePostMutation();
  
  // Simple addPrompt function - stores prompts in localStorage
  const addPrompt = useCallback((prompt: string) => {
    try {
      const existing = localStorage.getItem("recentPrompts");
      const prompts = existing ? JSON.parse(existing) : [];
      const updated = [prompt, ...prompts.filter((p: string) => p !== prompt)].slice(0, 10);
      localStorage.setItem("recentPrompts", JSON.stringify(updated));
    } catch (error) {
      console.warn("Failed to save recent prompt:", error);
    }
  }, []);

  const text = UI_TEXT[selectedLanguage] ?? UI_TEXT.English;
  
  // Load draft on mount
  useEffect(() => {
    const draft = loadStoryDraft();
    if (draft) {
      setTextareaValue(draft.prompt || "");
      setSelectedGenre(draft.genre || "");
      setSelectedLength(draft.length || "medium");
      setSelectedLanguage(draft.language || "English");
      setSelectedTone((draft.tone as ToneLabel) || "");
    if (!textareaValue.trim()) {
      return;
    }

    const timer = setTimeout(() => {
      const draftData: StoryDraftData = {
        prompt: textareaValue,
        genre: selectedGenre,
        length: selectedLength,
        language: selectedLanguage,
        tone: selectedTone,
        savedAt: new Date().toISOString(),
      };

      try {
        saveStoryDraft(draftData);
        setDraftStatus(`Draft saved ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
      } catch (err) {
        if (err instanceof DOMException && err.name === "QuotaExceededError") {

          toast.error("Couldn't autosave draft ├óΓé¼ΓÇ¥ storage limit reached.");
        }

      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [textareaValue, selectedGenre, selectedLength, selectedLanguage, selectedTone]);



    if (!("speechSynthesis" in window)) {
      toast.error("Text-to-speech is not supported in this browser.");
      return;
    }
  }, []);

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(event.target as Node)) {
        setIsLanguageDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Play soundtrack when genre changes
  const playSoundtrack = useCallback((genre: string) => {
    const soundtrack = soundtrackMap[genre];
    if (!soundtrack) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = soundtrack;
      audioRef.current.play().catch(() => {});
    }


  }, []);

  // Clear prompt
  const handleClearPrompt = useCallback(() => {
    setTextareaValue("");
    setSelectedPrompt("");
    setValue("prompt", "");
  }, [setValue]);

  // Generate story handler
  const onSubmit: SubmitHandler<Inputs> = useCallback(async (data) => {
    if (getWordCount(data.prompt) < 10) {
      toast.error("Please enter a prompt with at least 10 words to generate a story.");
      return;
    }

    // Guest limit check
    if (!login && guestRequestCount >= 3) {
      setShowLimitModal(true);
      return;
    }

    setLoading(true);

    try {
      const payload = {
        prompt: selectedGenre ? `[Genre: ${selectedGenre}] ${data.prompt}` : data.prompt,
        wordLength: selectedLength === "short" ? 175 : selectedLength === "long" ? 800 : 450,
        language: selectedLanguage,
        tone: selectedTone || undefined,
      };

      const generationRequest = login ? generateModel(payload) : generateFreeModel(payload);
      const res = await generationRequest.unwrap();
      
      if (res) {
        toast.success(res.message);
        addPrompt(data.prompt);
        const newStories = res.data as IStories[];
        setStories((prev) => [...prev, ...newStories]);
        // setSelectedStory is not used, but we're keeping the state
        setTextareaValue("");
        setSelectedPrompt("");
        setValue("prompt", "");
        localStorage.removeItem("storyDraft");
        reset();
        if (login) {
          refetchUsage();
        }
        if (!login) {
          const newCount = guestRequestCount + 1;
          setGuestRequestCount(newCount);
          localStorage.setItem("guestRequestCount", String(newCount));
        // Clear draft after successful generation
        localStorage.removeItem(DRAFT_KEY);
        setDraftStatus("");
        reset();
        
        if (selectedGenre) {
          playSoundtrack(selectedGenre);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        if (!login) {
          setGuestRequestCount((prev) => {
            const newCount = prev + 1;
            localStorage.setItem("guestRequestCount", String(newCount));
            return newCount;
          });
        }
      }
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [login, guestRequestCount, selectedGenre, selectedLength, selectedLanguage, selectedTone, generateModel, generateFreeModel, addPrompt, setValue, playSoundtrack, reset]);

  // Get unique stories
  const getUniqueStories = useCallback((storyList: IStories[]) => {
    const seen = new Set<string>();
    return storyList.filter((story) => {
      const key = `${story.title}-${story.content}-${story.tag}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    setTopics((currentTopics) =>
      currentTopics.filter((_, topicIndex) => topicIndex !== index)
    );
  };

  const handleCopyStory = async () => {
    if (selectedStory?.content) {
      await navigator.clipboard.writeText(selectedStory.content);
      setIsCopied(true);
      toast.success("Story copied!");
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleExportPDF = async () => {
    if (!selectedStory) { toast.error("No story available to export."); return; }
    if (!selectedStory.content?.trim()) {toast.error("Story content is empty. Cannot export.");return;}
    const toastId = toast.loading("Preparing your premium PDF...");

    try {
      // Helper to load image assets asynchronously with a safe timeout
      const loadImageWithTimeout = (src: string, timeoutMs: number = 3000): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          const timeout = setTimeout(() => {
            img.src = ""; // stop loading
            reject(new Error(`Timeout loading image: ${src}`));
          }, timeoutMs);

          img.onload = () => {
            clearTimeout(timeout);
            resolve(img);
          };
          img.onerror = (e) => {
            clearTimeout(timeout);
            reject(e);
          };
          img.src = src;
        });
      };

      let logoImg: HTMLImageElement | null = null;
      let storyImg: HTMLImageElement | null = null;

      try {
        logoImg = await loadImageWithTimeout(logo);
      } catch (err) {
        console.warn("Failed to load StorySparkAI logo for PDF", err);
      }

      if (selectedStory.imageURL) {
        try {
          storyImg = await loadImageWithTimeout(selectedStory.imageURL);
        } catch (err) {
          console.warn("Failed to load story banner image for PDF", err);
        }
      }

      // Initialize A4 PDF document (210mm x 297mm)
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const title = selectedStory.title || "Untitled Story";
      const content = selectedStory.content || "";
      const tag = (selectedStory.tag || "STORY").toUpperCase();

      const leftMargin = 20;
      const rightMargin = 20;
      const topMargin = 20;
      const bottomMargin = 20;
      const printableWidth = 210 - leftMargin - rightMargin; // 170 mm
      const maxY = 297 - bottomMargin - 10; // Bottom boundary (267mm) leaving room for footer

      let yCursor = topMargin;

      // 1. Header (Logo & Sub-header)
      if (logoImg) {
        const logoHeight = 8;
        const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
        doc.addImage(logoImg, "PNG", leftMargin, yCursor, logoWidth, logoHeight);
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(99, 102, 241); // Brand Indigo
        doc.text("StorySparkAI", leftMargin, yCursor + 6);
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text("PREMIUM AI GENERATED STORY", 190, yCursor + 5, { align: "right" });

      yCursor += 10;

      // Header Divider Line
      doc.setDrawColor(99, 102, 241); // Brand Indigo
      doc.setLineWidth(0.5);
      doc.line(leftMargin, yCursor, 190, yCursor);

      yCursor += 8;

      // 2. Story Banner Image (only on Page 1)
      if (storyImg) {
        const bannerHeight = 55;
        doc.addImage(storyImg, "JPEG", leftMargin, yCursor, printableWidth, bannerHeight);
        yCursor += bannerHeight + 8;
      }

      // 3. Story Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(30, 41, 59); // Slate 800
      const splitTitle = doc.splitTextToSize(title, printableWidth);
      splitTitle.forEach((line: string) => {
        doc.text(line, leftMargin, yCursor);
        yCursor += 9;
      });

      yCursor += 1;

      // 4. Meta Row (Generated Date & Genre Pill Badge)
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // Slate 500
      const formattedDate = new Date().toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      doc.text(`Generated on ${formattedDate}`, leftMargin, yCursor);

      // Genre pill badge on the right
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      const tagWidth = doc.getTextWidth(tag);
      const chipWidth = tagWidth + 5;
      const chipHeight = 5;
      const chipX = 190 - chipWidth;
      const chipY = yCursor - 3.8;

      doc.setFillColor(99, 102, 241); // Brand Indigo background
      doc.roundedRect(chipX, chipY, chipWidth, chipHeight, 1, 1, "F");

      doc.setTextColor(255, 255, 255); // White text inside pill
      doc.text(tag, chipX + 2.5, chipY + 3.5);

      yCursor += 4.5;

      // Meta row bottom line
      doc.setDrawColor(226, 232, 240); // Slate 200
      doc.setLineWidth(0.2);
      doc.line(leftMargin, yCursor, 190, yCursor);

      yCursor += 10;

      // 5. Story Paragraphs Flowing
      const paragraphs = content.split(/\n+/);
      const lineHeight = 6.5;
      const paragraphSpacing = 4.5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59); // Slate 800

      paragraphs.forEach((para: string, pIdx: number) => {
        const cleanPara = para.trim();
        if (!cleanPara) return;

        const lines = doc.splitTextToSize(cleanPara, printableWidth);
        lines.forEach((line: string) => {
          if (yCursor > maxY) {
            doc.addPage();
            yCursor = 30; // Top padding for subsequent pages
          }
          doc.setFont("helvetica", "normal");
          doc.setFontSize(11);
          doc.setTextColor(30, 41, 59); // Slate 800
          doc.text(line, leftMargin, yCursor);
          yCursor += lineHeight;
        });

        if (pIdx < paragraphs.length - 1) {
          yCursor += paragraphSpacing;
        }
      }
    } catch (error: any) {
      if (
        error?.status === 429 ||
        error?.status === "429" ||
        error?.data?.error === "QUOTA_EXCEEDED" ||
        (typeof error?.data?.message === "string" && error.data.message.includes("limit exceeded"))
      ) {
        setShowUpgradeModal(true);
      } else {
        toast.error(getErrorMessage(error));
      }
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      });


      // 6. Running Header and Footer generation
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        // Footer line
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.25);
        doc.line(leftMargin, 280, 190, 280);

        // Footer Text
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139); // Slate 500
        doc.text("Generated with StorySparkAI", leftMargin, 285);
        doc.text(`Page ${i} of ${totalPages}`, 190, 285, { align: "right" });

        // Header on pages 2+
        if (i > 1) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(99, 102, 241); // Brand Indigo
          doc.text("StorySparkAI", leftMargin, 14);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184); // Slate 400
          const headerTitle = title.length > 50 ? title.substring(0, 50) + "..." : title;
          doc.text(headerTitle, 190, 14, { align: "right" });

          doc.setDrawColor(241, 245, 249);
          doc.setLineWidth(0.2);
          doc.line(leftMargin, 17, 190, 17);
        }
      }

      // Save PDF with sanitized name
      const safeTitle = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      doc.save(`storyspark_${safeTitle}.pdf`);
      toast.dismiss(toastId);
      toast.success("PDF generated successfully!");
    } catch (err) {
      console.error("PDF generation error:", err);
      toast.dismiss(toastId);
      toast.error("Failed to generate PDF. Please try again.");
    }
  };

  const isOverLimit = textareaValue.length >= MAX_PROMPT_LENGTH;
  const isNearLimit = textareaValue.length >= MAX_PROMPT_LENGTH * WARN_THRESHOLD;
  
  useKeyboardShortcuts({
  onOpenHelp: () => setShowHelpModal(true),
  onCloseHelp: () => setShowHelpModal(false),
  onGenerate: () => {
    if (inputRef.current) {
      const form = inputRef.current.closest("form");
      if (form) form.requestSubmit();
    }
  },
  onPublish: () => {
    const publishBtn = document.getElementById("publish-story-btn");
    publishBtn?.click();
  },
  focusPrompt: () => {
    inputRef.current?.focus();
  },
  hasStory: stories.length > 0,
});
  }, []);

  const uniqueStories = useMemo(() => getUniqueStories(stories), [stories, getUniqueStories]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onOpenHelp: () => setShowHelpModal(true),
    onCloseHelp: () => setShowHelpModal(false),
    onGenerate: () => {
      if (isGenerateDisabled) return;
      if (inputRef.current) {
        const form = inputRef.current.closest("form");
        if (form) form.requestSubmit();
      }
    },
    onPublish: () => {
      const publishBtn = document.getElementById("publish-story-btn");
      publishBtn?.click();
    },
    focusPrompt: () => {
      inputRef.current?.focus();
    },
    hasStory: stories.length > 0,
  });

  const isOverLimit = textareaValue.length >= MAX_PROMPT_LENGTH;
  const isNearLimit = textareaValue.length >= MAX_PROMPT_LENGTH * WARN_THRESHOLD;
  const isDangerLimit = textareaValue.length >= MAX_PROMPT_LENGTH * DANGER_THRESHOLD;
  const isGenerateDisabled = loading || isOverLimit || !textareaValue.trim();

  return (
    <div className="bg-gradient-to-br animate-gradient-slow min-h-screen relative overflow-x-hidden">
      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="py-6 flex flex-col md:flex-row items-center md:items-start justify-between gap-4">
          <div className="pt-2 w-full md:w-auto flex justify-start">
            <Link to="/">
              <div className="!rounded-button bg-gradient-to-r from-white/20 to-white/10 hover:from-white/30 hover:to-white/20 text-gray-300 px-3 py-2 flex items-center gap-2 transition-all duration-300 rounded whitespace-nowrap">
                <i className="fa-solid fa-left-long"></i> {text.back}
            {!login && (
              <div className="pt-2 text-center">
                <div className="!rounded-button bg-gradient-to-r from-white/20 to-white/10 text-gray-400 px-3 py-2 flex items-center gap-2 transition-all duration-300 rounded text-sm whitespace-normal md:whitespace-nowrap leading-relaxed">
                  <span>
                    Free access for 3 requests ΓÇö <Link to="/login"><span className="text-indigo-400 underline font-semibold">Login</span></Link> for more!
                  </span>
                </div>
              </div>
            </Link>
          </div>

          {!login && (
            <div className="pt-2 text-center">
              <div className="!rounded-button bg-gradient-to-r from-white/20 to-white/10 text-gray-400 px-3 py-2 flex items-center gap-2 transition-all duration-300 rounded text-sm whitespace-normal md:whitespace-nowrap leading-relaxed">
                <span>
                  {text.freeAccess} — <Link to="/login"><span className="text-indigo-400 underline font-semibold">{text.login}</span></Link> {text.forMore}
                  Free access for 3 requests ΓÇö <Link to="/login"><span className="text-indigo-400 underline font-semibold">Login</span></Link> for more!
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-col items-center md:items-end pt-2 w-full md:w-auto">
            <button className="!rounded-button bg-gradient-to-r from-white/20 to-white/10 hover:from-white/30 hover:to-white/20 text-gray-300 px-3 py-2 flex items-center gap-2 transition-all duration-300 rounded whitespace-nowrap">
              <span>
                <span className="text-gray-400 text-xs mr-1">{text.perMonth}</span>
                {getRequestLimit(subscriptionType)}
              </span>
              <Link to="/pricing" className="border-1 border-white/20 pl-2 text-gray-300">
                {text.upgrade}
              </Link>
              <i className="fas fa-bolt text-yellow-400"></i>
            </button>
            <div className="mt-3 text-gray-500 text-xs text-center md:text-right">
              <span>
                {text.monthlyRequests}: {login ? (profile?.requestsThisMonth ?? 0) : guestRequestCount}
              </span>
              <br />
              <span>{text.totalPosts}: {login ? (profile?.postsCount ?? 0) : 0}</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="mt-11">
          <h1 className="text-slate-900 dark:text-gray-300 text-2xl sm:text-3xl md:text-4xl font-extrabold text-center mb-12">
            ✨ {text.titleStart}{" "}
          <h1 className="text-gray-300 text-2xl sm:text-3xl md:text-4xl font-extrabold text-center mb-12">
            Γ£¿ Turn Your Ideas Into{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-300 to-blue-400">
              Amazing Stories!
          <h1 className="text-slate-900 dark:text-gray-300 text-2xl sm:text-3xl md:text-4xl font-extrabold text-center mb-12">
            ├ó┼ô┬¿ {text.titleStart}{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-300 to-blue-400">
              {text.titleAccent}
            </span> ✨
            </span>{" "}
            ├ó┼ô┬¿
          </h1>

          {showTemplateScreen ? (
            <TemplateSelectionScreen onSelectTemplate={handleSelectTemplate} onStartBlank={handleStartBlank} />
          ) : (
          <div className="max-w-3xl mx-auto px-4 sm:px-0">
            <div className="bg-blue-500/10 rounded-md p-4 border border-gray-400">
              <div className="relative">
                <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                  {/* Genre chips */}
<div className="relative">
  <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
    <div className="flex flex-wrap gap-2 mb-3">
      {[
        "≡ƒÄ¡ Drama",
        "≡ƒÿé Comedy",
        "≡ƒÿ▒ Horror",
        "≡ƒÆò Romance",
        "≡ƒÜÇ Sci-Fi",
        "≡ƒºÖ Fantasy",
        "≡ƒöì Mystery",
        "≡ƒîƒ Adventure",
      ].map((genre) => (
        <button
          key={genre}
          type="button"
          onClick={() =>
            setSelectedGenre(selectedGenre === genre ? "" : genre)
          }
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
            selectedGenre === genre
              ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
              : "bg-white/10 text-gray-400 hover:bg-white/20 hover:text-gray-200"
          }`}
        >
          {genre}
        </button>
      ))}
    </div>
        </div>
          <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/50 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
            <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-[-50px] left-[-50px] w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <h3 className="text-xl font-bold text-slate-200 relative z-10">
                Generated Story
              </h3>
              <div className="flex flex-wrap items-center gap-2 relative z-10">
                <button
                  type="button"
                  className="rounded-lg px-4 py-2 bg-slate-700 text-slate-200 font-semibold cursor-pointer hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleCopyStory}
                  disabled={!selectedStory}
                >
                  {isCopied ? "╬ô┬ú├┤ Copied" : "Γëí╞Æ├┤├» Copy"}
                </button>
                <button
                  type="button"
                  className="rounded-lg px-4 py-2 bg-purple-700 text-slate-200 font-semibold cursor-pointer hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleExportPDF}
                  disabled={!selectedStory}
                >
                  Γëí╞Æ├┤├ñ Export PDF
                </button>
                <button
                  type="button"
                  className="rounded-lg px-4 py-2 bg-indigo-700 text-slate-200 font-semibold cursor-pointer hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleExportMarkdown}
                  disabled={!selectedStory}
                >
                  ╬ô┬╝├ºΓê⌐Γòò├à Export as Markdown
                </button>
                <button
                  type="button"
                  className="rounded-lg px-4 py-2 bg-violet-700 text-slate-200 font-semibold cursor-pointer hover:bg-violet-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => setShowWorldMap(true)}
                  disabled={!selectedStory}
                >
                  ╬ô├½├¡Γò₧├åΓö£Γòú╬ô├▓├ª╬ô├¬ΓîÉ╬ô├▓├▓Γö£├á World Map
                </button>
                <button
                  type="button"
                  className="rounded-lg px-4 py-2 bg-fuchsia-700 text-slate-200 font-semibold cursor-pointer hover:bg-fuchsia-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => setShowRemix(true)}
                  disabled={!selectedStory}
                >
                  ╬ô├½├¡Γò₧├åΓö£ΓòóΓö£├º Remix
                </button>
                <button
                  type="button"
                  id="publish-story-btn"
                  className={`rounded-lg px-5 py-2 font-semibold flex items-center space-x-2 cursor-pointer bg-blue-600 text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                    loading ? "" : "hover:bg-blue-500 hover:shadow-lg active:scale-95"
                  }`}
                  onClick={handelPublishStory}
                  disabled={loading || !selectedStory}
                >
                  {loading ? "Publishing..." : "Publish"}
                </button>
              </div>
            </div>

          <div className="max-w-3xl mx-auto px-4 sm:px-0">
            <div className="bg-gray-50 rounded-md p-4 border border-gray-200 text-slate-900 dark:bg-blue-500/10 dark:border-gray-400 dark:text-white overflow-hidden">
              <div className="relative w-full">
                <form className="space-y-4 w-full" onSubmit={handleSubmit(onSubmit)}>

                  {/* ├óΓÇ¥Γé¼├óΓÇ¥Γé¼ Genre chips ├óΓÇ¥Γé¼├óΓÇ¥Γé¼ */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {GENRES.map((genre) => (
                      <button
                        key={genre.value}
                        type="button"
                        onClick={() => {
                          const newGenre = selectedGenre === genre.value ? "" : genre.value;
                          setSelectedGenre(newGenre);
                          if (newGenre) playSoundtrack(newGenre);
                        }}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                          selectedGenre === genre.value
                            ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                            : "bg-white/10 text-gray-400 hover:bg-white/20 hover:text-gray-200"
                        } ${loading ? "cursor-not-allowed opacity-50" : ""}`}
                      >
                        {genre.icon} {genre.name}
                      </button>
                    ))}
                  </div>

                  {/* Tone Picker */}
                  <TonePicker selected={selectedTone} onChange={setSelectedTone} />

                  {/* Length selector */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-xs text-gray-400 mr-1">📏 {text.length}:</span>
                    {lengths.map((length) => (
                      <button
                        key={length}
                        type="button"
                        onClick={() => setSelectedLength(length)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                          selectedLength === length
                            ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                            : "bg-white/10 text-gray-400 hover:bg-white/20 hover:text-gray-200"
                        }`}
                      >
                        {text[length]}
                      </button>
                    ))}
                  </div>
                  {/* ├óΓÇ¥Γé¼├óΓÇ¥Γé¼ NEW: Tone picker ├óΓÇ¥Γé¼├óΓÇ¥Γé¼ */}
                  {/* ΓöÇΓöÇ NEW: Tone picker ΓöÇΓöÇ */}
                  <TonePicker selected={selectedTone} onChange={setSelectedTone} />


                    const rawParts = segment.text.split(/(\s+)/);
                    let wordOffset = 0;


                      {(["short", "medium", "long"] as const).map((length) => (
                        <button
                          key={length}
                          type="button"
                          disabled={loading}
                          onClick={() => setSelectedLength(length)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${selectedLength === length
                              ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                              : "bg-white/10 text-gray-400 hover:bg-white/20 hover:text-gray-200"
                            } ${loading ? "cursor-not-allowed opacity-50" : ""}`}
                        >
                          {text[length]}
                        </button>
                      ))}
                    </div>


                    <div className="flex items-center gap-2" ref={languageDropdownRef}>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1">≡ƒîÉ {text.language}:</span>
                      <div className="relative">
            <div className="relative z-10 mt-6">
              <AudioPlayer
                ref={audioPlayerRef}
                text={selectedStory.content}
                title={selectedStory.title}
                onWordIndexChange={setNarrationWordIndex}
                onPlaybackStateChange={setNarrationState}
              />
            </div>
          </div>
          <div className="mt-7">
            <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl p-6 mb-8">
              <h3 className="text-lg font-bold text-slate-200 mb-4">
                Select Topics
              </h3>
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <input
                  type="text"
                  value={newTopicTitle}
                  onChange={(event) => setNewTopicTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleAddTopic();
                    }
                  }}
                  placeholder="Add related topic"
                  className="flex-1 rounded-lg border border-slate-600 bg-slate-900/70 px-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                <button
                  type="button"
                  className="rounded-lg px-4 py-2 bg-blue-600 text-white font-semibold cursor-pointer hover:bg-blue-500 transition-colors"
                  onClick={handleAddTopic}
                >
                  Add Topic
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedStory ? (
                  <>
                    {topics.map((topic, index) => (
                      <span
                        key={index}
                        className={`inline-flex items-center gap-2 px-4 py-1.5 ${topic.className} rounded-full text-sm font-medium transition-transform hover:scale-105 shadow-sm`}
                      >
                        <button

                          disabled={loading}
                          onClick={() => !loading && setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
                          className={`flex items-center gap-2 px-3 py-1 bg-white/10 text-gray-300 border border-slate-700/50 rounded-full text-xs font-semibold hover:bg-white/20 transition-all duration-200 ${loading ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                            }`}
                        >
                          <span>{LANGUAGES.find(l => l.name === selectedLanguage)?.name || "English"}</span>
                          <span className="text-gray-400 text-[10px]">├óΓÇô┬╝</span>

                        </button>

                        {isLanguageDropdownOpen && (
                          <ul className="absolute right-0 z-20 mt-1.5 max-h-48 w-40 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl focus:outline-none divide-y divide-slate-100 dark:divide-white/5 p-1 box-border list-none m-0">
                            {LANGUAGES.map((lang) => (
                              <li key={lang.code} className="p-0 m-0 list-none">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedLanguage(lang.name);
                                    setIsLanguageDropdownOpen(false);
                                  }}

                                  className={`w-full text-left px-3 py-2 text-xs transition-colors duration-150 cursor-pointer ${selectedLanguage === lang.name
                                      ? "bg-indigo-600 text-white font-bold"
                                      : "text-gray-400 hover:bg-indigo-600/50 hover:text-white"
                                    }`}

                  {/* Language selector */}
                  <div className="flex items-center gap-2 mb-3" ref={languageDropdownRef}>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1">🌐 {text.language}:</span>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
                        className="flex items-center gap-2 px-3 py-1 bg-white/10 text-gray-300 border border-slate-700/50 rounded-full text-xs font-semibold hover:bg-white/20 transition-all duration-200"
                      >
                        <span>{LANGUAGES.find(l => l.name === selectedLanguage)?.name || "English"}</span>
                        <span className="text-gray-400 text-[10px]">▼</span>
                      </button>
                      {isLanguageDropdownOpen && (
                        <ul className="absolute right-0 z-20 mt-1.5 max-h-48 w-40 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl divide-y divide-slate-100 dark:divide-white/5 p-1">
                          {LANGUAGES.map((lang) => (
                            <li key={lang.code}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedLanguage(lang.name);
                                  setIsLanguageDropdownOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-xs transition-colors duration-150 rounded-lg ${
                                  selectedLanguage === lang.name
                                    ? "bg-indigo-600 text-white font-bold"
                                    : "text-gray-400 hover:bg-indigo-600/50 hover:text-white"
                                }`}
                              >
                                {lang.name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* Prompt textarea */}

                  {/* ├óΓÇ¥Γé¼├óΓÇ¥Γé¼ Prompt textarea ├óΓÇ¥Γé¼├óΓÇ¥Γé¼ */}
                  <div className="relative w-full">
                    <textarea
                      {...register("prompt")}
                      ref={(el) => {
                        register("prompt").ref(el);
                        inputRef.current = el;
                      }}
                      disabled={loading}
                      className={`w-full h-32 sm:h-40 resize-none border-none outline-none bg-transparent text-gray-800 dark:text-gray-200 focus:ring-0 text-lg leading-relaxed tracking-wide placeholder:italic placeholder:text-gray-500 dark:placeholder:text-gray-400 pr-12 transition-colors duration-200 box-border ${
                        isOverLimit ? "ring-1 ring-red-500 rounded" : isNearLimit ? "ring-1 ring-yellow-400 rounded" : ""
                      }`}
                      placeholder={text.promptPlaceholder}
                      value={textareaValue}
                      maxLength={MAX_PROMPT_LENGTH}
                      onChange={(e) => setTextareaValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                          e.preventDefault();
                          if (isGenerateDisabled) return;
                          const form = e.currentTarget.closest("form");
                          if (form) form.requestSubmit();
                        }
                      }}
                    />
                    {textareaValue.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearPrompt}
                        className="absolute right-2 top-2 text-gray-400 hover:text-red-500 transition-colors duration-200"
                        aria-label={text.close}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Character count */}
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-200/40 dark:border-white/5">
                    <div className="flex-1 min-w-0 pr-4">
                      {isOverLimit ? (
                        <p className="text-[11px] font-semibold text-red-500 dark:text-red-400 flex items-center gap-1 truncate m-0">
                          <span>⚠</span> {text.characterLimit}
                        </p>
                      ) : isNearLimit ? (
                        <p className="text-[11px] font-semibold text-amber-500 dark:text-amber-400 flex items-center gap-1 truncate m-0">
                          <span>⚠</span> {MAX_PROMPT_LENGTH - textareaValue.length} {text.charactersRemaining}
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-200/40 dark:border-white/5 select-none w-full box-border">
                      <div className="flex-1 min-w-0 pr-4">
                        {isOverLimit ? (
                          <p className="text-[11px] font-semibold text-red-500 dark:text-red-400 flex items-center gap-1 truncate m-0">
                            <span>ΓÜá</span> {text.characterLimit}
                          </p>
                        ) : isNearLimit ? (
                          <p className="text-[11px] font-semibold text-amber-500 dark:text-amber-400 flex items-center gap-1 truncate m-0">
                            <span>ΓÜá</span> {MAX_PROMPT_LENGTH - textareaValue.length} {text.charactersRemaining}
                          </p>
                        ) : null}
                      </div>

                      <span
  aria-live="polite"
  className={`text-[11px] font-bold tabular-nums shrink-0 ml-auto ${
    isOverLimit || isDangerLimit
      ? "text-red-500 dark:text-red-400"
      : isNearLimit
      ? "text-amber-500"
      : "text-slate-400"
  }`}
>
  {textareaValue.length} / {MAX_PROMPT_LENGTH}
</span>
                    </div>
                  </div>

                  <div className="text-[11px] font-medium leading-relaxed text-slate-400 dark:text-slate-500 select-none w-full box-border">
                    ≡ƒÆí <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-1">{text.keyboardTip}</span>
                    {text.press} <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-md text-slate-700 dark:text-slate-300 mx-0.5 shadow-sm">Enter</kbd> to continue &bull;{" "}
                    Press <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-md text-slate-700 dark:text-slate-300 mx-0.5 shadow-sm">{typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC") ? "Cmd" : "Ctrl"} + Enter</kbd> to generate &bull;{" "}
                    <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-md text-slate-700 dark:text-slate-300 mx-0.5 shadow-sm">Shift + Enter</kbd> {text.forNewLine}
                  </div>


                  <div className="flex justify-end pt-2 w-full box-border">
                    <button
                      type="button"

                      disabled={loading}
                      onClick={() => !loading && setIsRecentPromptsOpen(!isRecentPromptsOpen)}
                      className={`absolute right-2 top-12 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm transition-colors duration-200 flex items-center gap-2 ${loading
                          ? "cursor-not-allowed opacity-60"
                          : "hover:bg-indigo-700"
                        }`}
                      aria-label={text.recentPrompts}
                      title={text.recentPrompts}

                    >
                      <span>Next: Cast of Characters Γ₧í∩╕Å</span>
                    </button>
            {/* Alternate Endings Section */}
            {selectedStory && (
              <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl p-6 mt-8 relative overflow-hidden">
                <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>
                
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-slate-200 flex items-center gap-2">
                      Alternate Endings
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Explore alternate narrative styles for your story context.
                    </p>
                  </div>
                  {selectedStory.content !== originalStoryContent[selectedStory.uuid] && (
                    <button
                      type="button"
                      onClick={handleResetEnding}
                      className="rounded-lg px-4 py-2 bg-red-950/40 hover:bg-red-900/60 text-red-200 border border-red-700/50 font-semibold text-sm transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <i className="fa-solid fa-rotate-left"></i> Reset to Original
                    </button>
                  )}
                </div>

                  <div className="space-y-2 select-none">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                      Cast of Characters
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Define custom characters to ensure Gemini maintains character roles, personality traits, and dynamic relationships consistently throughout the story.
                    </p>
                  </div>

                  {login && selectedRosterCharacter && (
                    <div className="mt-4 mb-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                      <div className="mb-3">
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          Character Portrait
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Generate an AI portrait from the saved character&apos;s profile.
                        </p>
                      </div>

                      <CharacterPortrait character={selectedRosterCharacter} />
                    </div>
                  )}

                    <div className="flex items-center justify-between mt-1 px-1">
                      {isOverLimit ? (
                        <p className="text-xs text-red-400 flex items-center gap-1">
                          <span>ΓÜá∩╕Å</span> {text.characterLimit}
                        </p>
                      ) : isNearLimit ? (
                        <p className="text-xs text-yellow-400 flex items-center gap-1">
                          <span>ΓÜá∩╕Å</span>{" "}
                          {MAX_PROMPT_LENGTH - textareaValue.length} {text.charactersRemaining}
                        </p>
                      ) : null}
                    </div>
                    <span className={`text-[11px] font-bold tabular-nums shrink-0 ml-auto ${isOverLimit || isDangerLimit ? "text-red-500 dark:text-red-400" : isNearLimit ? "text-amber-500" : "text-slate-400"}`}>
                      {textareaValue.length} / {MAX_PROMPT_LENGTH}
                    </span>
                  </div>

                  {/* Keyboard tips */}
                  <div className="text-[11px] font-medium leading-relaxed text-slate-400 dark:text-slate-500">
                    💡 <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-1">{text.keyboardTip}</span>
                    {text.press} <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-md text-slate-700 dark:text-slate-300 mx-0.5 shadow-sm">Enter</kbd> to continue •{" "}
                    Press <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-md text-slate-700 dark:text-slate-300 mx-0.5 shadow-sm">Ctrl + Enter</kbd> to generate •{" "}
                    <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-md text-slate-700 dark:text-slate-300 mx-0.5 shadow-sm">Shift + Enter</kbd> {text.forNewLine}
                  ) : (
                    <div className="space-y-4">
                      {characters.map((char, index) => (
                        <div
                          key={char.id}
                          className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-white/5 rounded-2xl space-y-4 relative"
                        >
                          <div className="flex items-center justify-between select-none">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              ≡ƒæñ Character #{index + 1}
                            </span>
                            <div className="flex gap-2">
                              {login && (
                                <>
                                  <select
                                    className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2"
                                    onChange={(e) => {
                                      const rosterCharId = e.target.value;

                                      if (rosterCharId) {
                                        handleLoadFromRoster(char.id, rosterCharId);
                                      }
                                    }}
                                  >
                                    <option value="">Load from Roster...</option>

                                    {rosterCharacters.map((rosterCharacter) => (
                                      <option
                                        key={rosterCharacter._id}
                                        value={rosterCharacter._id}
                                      >
                                        {rosterCharacter.name} ({rosterCharacter.role || "Character"})
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveToRoster(char)}
                                    disabled={isSavingCharacter}
                                    className="text-xs font-bold text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 cursor-pointer"
                                  >
                                    Save
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveCharacter(char.id)}
                                className="text-xs font-bold text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 hover:underline cursor-pointer"
                              >
                                Remove
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Name</label>
                              <input
                                type="text"
                                value={char.name}
                                onChange={(e) => handleCharacterChange(char.id, "name", e.target.value)}
                                placeholder="e.g. Leo, Sir Cedric, Bella"
                                className="w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-blue-500/40 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 placeholder:italic"
                              />
                            </div>

                  <div className="space-y-4">
                    {characters.map((char, index) => (
                      <div
                        key={char.id}
                        className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-white/5 rounded-2xl space-y-4 relative"
                      >
                        <div className="flex items-center justify-between select-none">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            ≡ƒæñ Character #{index + 1}
                          </span>
                          <div className="flex gap-2">
                            {login && (
                              <>
                                <select
                                  className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2"
                                  onChange={(e) => {
                                    const rosterCharId = e.target.value;

                                    if (rosterCharId) {
                                      handleLoadFromRoster(char.id, rosterCharId);
                                    }
                                  }}
                                >
                                  <option value="">Load from Roster...</option>

                                  {rosterCharacters.map((rosterCharacter) => (
                                    <option
                                      key={rosterCharacter._id}
                                      value={rosterCharacter._id}
                                    >
                                      {rosterCharacter.name} ({rosterCharacter.role || "Character"})
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleSaveToRoster(char)}
                                  disabled={isSavingCharacter}
                                  className="text-xs font-bold text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 cursor-pointer"
                                >
                                  Save
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveCharacter(char.id)}
                              className="text-xs font-bold text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 hover:underline cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        </div>

    <div className="flex flex-wrap items-center gap-2 mb-3">
      <span className="text-xs text-gray-400 mr-1">≡ƒôÅ Length:</span>

      {lengths.map((length) => (
        <button
          key={length}
          type="button"
          onClick={() => setSelectedLength(length)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
            selectedLength === length
              ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
              : "bg-white/10 text-gray-400 hover:bg-white/20 hover:text-gray-200"
          }`}
        >
          {length.charAt(0).toUpperCase() + length.slice(1)}
        </button>
      ))}
    </div>

    <div className="flex flex-wrap items-center gap-2 mb-3">
      <span className="text-xs text-gray-400 mr-1">👥 Audience:</span>
      {["Children (5-10)", "Young Adult (12-18)", "General Audience", "Professionals"].map((audience) => (
        <button
          key={audience}
          type="button"
          onClick={() => setSelectedAudience(audience)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
            selectedAudience === audience
              ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
              : "bg-white/10 text-gray-400 hover:bg-white/20 hover:text-gray-200"
          }`}
        >
          {audience}
        </button>
      ))}
    </div>

    <div className="relative">
      <textarea
  {...register("prompt")}
  ref={(el) => {
    register("prompt").ref(el);
    inputRef.current = el;
  }}
        className={`w-full h-32 sm:h-40 resize-none border-none outline-none bg-transparent text-gray-300 focus:ring-0 text-lg leading-relaxed tracking-wide placeholder:italic placeholder:text-gray-500 pr-10 transition-colors duration-200 ${
          isOverLimit
            ? "ring-1 ring-red-500 rounded"
            : isNearLimit
            ? "ring-1 ring-yellow-400 rounded"
            : ""
        }`}
        placeholder="Every great story begins with a single idea. What's yours?"
        value={textareaValue}
        maxLength={MAX_PROMPT_LENGTH}
        onChange={(e) => setTextareaValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            const form = e.currentTarget.closest("form");
            if (form) form.requestSubmit();
          }
        }}      
        />

      {textareaValue.length > 0 && (
        <button
          type="button"
          onClick={handleClearPrompt}
          className="absolute right-2 top-2 text-gray-400 hover:text-red-500 transition-colors duration-200"
          aria-label="Clear prompt"
          title="Clear prompt"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}

      <div className="flex items-center justify-between mt-1 px-1">
        {isOverLimit ? (
          <p className="text-xs text-red-400 flex items-center gap-1">
            <span>ΓÜá</span> Character limit reached ΓÇö generate is disabled
          </p>
        ) : isNearLimit ? (
          <p className="text-xs text-yellow-400 flex items-center gap-1">
            <span>ΓÜá</span>{" "}
            {MAX_PROMPT_LENGTH - textareaValue.length} characters remaining
          </p>
        ) : (
          <span />
        )}

        <span
          className={`text-xs tabular-nums ml-auto ${
            isOverLimit
              ? "text-red-400 font-medium"
              : isNearLimit
              ? "text-yellow-400"
              : "text-gray-500"
          }`}
        >
          {textareaValue.length} / {MAX_PROMPT_LENGTH}
        </span>
      </div>
    </div>

    <p className="text-xs text-gray-500 mt-1 px-1">
      ≡ƒÆí  <span className="font-medium">Keyboard tip:</span> Press{" "}
      <kbd className="px-1 py-0.5 text-xs bg-gray-700 rounded border border-gray-600">
        Enter
      </kbd>{" "}
      to generate &bull;{" "}
      <kbd className="px-1 py-0.5 text-xs bg-gray-700 rounded border border-gray-600">
        Ctrl + Enter
      </kbd>{" "}
      also works &bull;{" "}
      <kbd className="px-1 py-0.5 text-xs bg-gray-700 rounded border border-gray-600">
        Shift + Enter
      </kbd>{" "}
      for new line
    </p>

    <div className="flex justify-end mt-2 w-full">
      <button
        type="submit"
        disabled={isSubmitting || isOverLimit}
        className={`w-full sm:w-auto justify-center rounded-lg bg-gradient-to-r from-blue-400 to-indigo-500 text-gray-200 px-6 py-3 font-semibold ${
          isSubmitting || isOverLimit
            ? "opacity-50 cursor-not-allowed"
            : "hover:shadow-lg hover:shadow-indigo-500/50 hover:scale-105"
        } transition-all duration-300 transform flex items-center space-x-2 group cursor-pointer`}
      >
        {isSubmitting ? (
          <>
            <i className="fas fa-spinner fa-spin text-xl"></i>
            <span>Generating...</span>
          </>
        ) : (
          <>
            <i className="fas fa-wand-magic-sparkles text-xl transition-transform duration-300 group-hover:animate-wiggle"></i>
            <span>Generate</span>
          </>
        )}
      </button>
    </div>
  </form>
</div>
            </div>

            <div className="w-full max-w-2xl m-auto mt-4">
  <h1 className="text-sm text-gray-500 mb-1">
    Here are some example prompts you can refer to:-
  </h1>

  <div className="relative" ref={dropdownRef}>
    <button
      type="button"
      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      className="w-full p-3 bg-slate-800 text-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 flex items-center justify-between text-sm text-left transition-all duration-200"
    >
      <span className="truncate pr-4">
        {selectedPrompt || "Select a prompt"}
      </span>

      <span
        className={`text-gray-300 transition-transform duration-200 ${
          isDropdownOpen ? "rotate-180" : ""
        }`}
      >
        Γû╝
      </span>
    </button>

    {isDropdownOpen && (
      <ul className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto bg-slate-800 border border-slate-700/50 rounded-lg shadow-xl focus:outline-none divide-y divide-slate-700/30">
        {prompts.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => {
                setSelectedPrompt(item.prompt);
                setTextareaValue(item.prompt);
                setIsDropdownOpen(false);
              }}
              className="w-full text-left px-4 py-3 text-sm text-gray-400 hover:bg-indigo-600 hover:text-white transition-colors duration-150 whitespace-normal break-words leading-relaxed"
            >
              {item.prompt}
            </button>
          </li>
        ))}
      </ul>
    )}
  </div>
</div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Name</label>
                            <input
                              type="text"
                              value={char.name}
                              onChange={(e) => handleCharacterChange(char.id, "name", e.target.value)}
                              placeholder="e.g. Leo, Sir Cedric, Bella"
                              className="w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-blue-500/40 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 placeholder:italic"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Role</label>
                            <select
                              value={char.role}
                              onChange={(e) => handleCharacterChange(char.id, "role", e.target.value)}
                              className="w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:border-blue-500/40 text-slate-800 dark:text-slate-200"
                            >
                              <option value="Protagonist">Protagonist (Hero/Main Character)</option>
                              <option value="Companion">Companion (Sidekick/Friend)</option>
                              <option value="Rival">Rival (Competitor)</option>
                              <option value="Antagonist">Antagonist (Villain/Obstacle)</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Personality & Traits</label>
                          <textarea
                            value={char.personality}
                            onChange={(e) => handleCharacterChange(char.id, "personality", e.target.value)}
                            placeholder="e.g. Brave but clumsy, loves eating carrots, afraid of the dark..."
                            rows={2}
                            className="w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl outline-none resize-none focus:border-blue-500/40 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 placeholder:italic"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-gray-500 mt-1 px-1">
                    ≡ƒÆí <span className="font-medium">{text.keyboardTip}</span> {text.press}{" "}
                    <kbd className="px-1 py-0.5 text-xs bg-gray-700 rounded border border-gray-600">
                      Enter
                    </kbd>{" "}
                    {text.toGenerate} &bull;{" "}
                    <kbd className="px-1 py-0.5 text-xs bg-gray-700 rounded border border-gray-600">
                      Ctrl + Enter
                    </kbd>{" "}
                    {text.alsoWorks} &bull;{" "}
                    <kbd className="px-1 py-0.5 text-xs bg-gray-700 rounded border border-gray-600">
                      Shift + Enter
                    </kbd>{" "}
                    {text.forNewLine}
                  </p>

                  {/* ├óΓÇ¥Γé¼├óΓÇ¥Γé¼ Generate button row ├óΓÇ¥Γé¼├óΓÇ¥Γé¼ */}
                  <div className="flex items-center justify-between mt-2 w-full">
                    {/* Active tone badge */}
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      {selectedTone && (
                        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/10 border border-white/10">
                          {TONES.find((t) => t.label === selectedTone)?.emoji}{" "}
                          <span className="font-medium">{selectedTone}</span>

                          <button
                            key={s.name}
                            type="button"

                            disabled={loading}
                            onClick={() => setSelectedTone("")}
                            className={`ml-1 text-gray-500 transition-colors ${loading
                                ? "cursor-not-allowed opacity-50"
                                : "hover:text-red-400"
                              }`}
                            aria-label="Remove tone"
                          >
                            ├âΓÇö

                          </button>
                        );
                      })}
                    </div>

                    {/* Tab content */}
                    {(() => {
                      const currentEndings = endingsCache[selectedStory.uuid] || [];
                      const currentEndingData = currentEndings.find((e) => e.style === activeEndingTab);
                      if (!currentEndingData) return null;
                      
                      const isCurrentlyApplied = selectedStory.content === currentEndingData.fullStory;
                      
                      return (
                        <div className="bg-slate-900/40 rounded-xl p-6 border border-slate-700/30">
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="text-lg font-bold text-slate-200">
                              {activeEndingTab} Suggestion
                            </h4>
                            <div>
                              {isCurrentlyApplied ? (
                                <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-full font-semibold flex items-center gap-1.5">
                                  <i className="fa-solid fa-check"></i> Applied to Story
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleApplyEnding(currentEndingData)}
                                  className="rounded-lg px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold text-sm transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-md hover:shadow-purple-500/20"
                                >
                                  Apply to Story
                                </button>
                              )}
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                            <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800 leading-relaxed text-slate-300 text-sm md:text-base italic shadow-inner whitespace-pre-wrap">
                              <p>{currentEndingData.ending}</p>
                            </div>
                            
                            <div>
                              <details className="group border border-slate-800 rounded-lg overflow-hidden bg-slate-950/20">
                                <summary className="list-none flex items-center justify-between p-3 text-xs font-bold text-slate-400 hover:text-slate-200 cursor-pointer select-none">
                                  <span>PREVIEW FULL STORY WITH THIS ENDING</span>
                                  <span className="transition-transform duration-200 group-open:rotate-180">╬ô├╗Γò¥</span>
                                </summary>
                                <div className="p-4 border-t border-slate-800/80 text-xs text-slate-400 leading-relaxed max-h-56 overflow-y-auto whitespace-pre-wrap">
                                  {currentEndingData.fullStory}
                                </div>
                              </details>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Generate button */}
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isGenerateDisabled}
                      className={`rounded-lg bg-gradient-to-r from-blue-400 to-indigo-500 text-gray-200 px-6 py-3 font-semibold ${
                        isGenerateDisabled ? "opacity-50 cursor-not-allowed" : "hover:shadow-lg hover:shadow-indigo-500/50"
                      } transition-all duration-300 transform hover:scale-105 flex items-center space-x-2 group cursor-pointer`}
                    >
                      <i className={`fas ${loading ? "fa-circle-notch animate-spin" : "fa-wand-magic-sparkles"} text-xl transition-transform duration-300 group-hover:animate-wiggle`}></i>
                      <span>{loading ? text.generating : text.generate}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Example prompts dropdown */}
            <div className="w-full max-w-2xl m-auto mt-4">
              <h1 className="text-sm text-gray-500 mb-1">{text.examples}</h1>
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full p-3 bg-slate-800 text-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 flex items-center justify-between text-sm text-left transition-all duration-200"
                >
                  <span className="truncate pr-4">{selectedPrompt || text.selectPrompt}</span>
                  <span className={`text-gray-300 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`}>▼</span>

                  <span className={`text-[11px] font-bold tabular-nums shrink-0 ml-auto ${
                    isOverLimit || isDangerLimit ? "text-red-500 dark:text-red-400" : isNearLimit ? "text-amber-500" : "text-slate-400"
                  }`}>
                    {textareaValue.length} / {MAX_PROMPT_LENGTH}
                  </span>

                  <span
                    className={`text-gray-300 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""
                      }`}
                  >
                    ├óΓÇô┬╝
                  </span>
                </button>
                {isDropdownOpen && (
                  <ul className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto bg-slate-800 border border-slate-700/50 rounded-lg shadow-xl divide-y divide-slate-700/30">
                    {prompts.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPrompt(item.prompt);
                            setTextareaValue(item.prompt);
                            setIsDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-3 text-sm text-gray-400 hover:bg-indigo-600 hover:text-white transition-colors duration-150 whitespace-normal break-words leading-relaxed"
                        >
                          {item.prompt}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              </div>

              {/* Quota Progress Bar */}
              {login && usageData && (
                <div className="w-full mb-4 p-4 rounded-xl border bg-slate-900/50 border-slate-800/80 backdrop-blur-md text-left box-border">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5 select-none">
                    <i className="fas fa-chart-pie text-indigo-400" />
                    Monthly Quota Limits ({usageData.plan.toUpperCase()})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Story Generations */}
                    <div>
                      <div className="flex justify-between text-xs mb-1 select-none">
                        <span className="text-slate-400 font-medium">Story Generations</span>
                        <span className="text-slate-300 font-bold">
                          {usageData.usage.story_generate.used} / {usageData.usage.story_generate.limit === null || usageData.usage.story_generate.limit === Infinity ? "∞" : usageData.usage.story_generate.limit}
                        </span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
                          style={{
                            width: `${usageData.usage.story_generate.limit === null || usageData.usage.story_generate.limit === Infinity ? 0 : Math.min(100, (usageData.usage.story_generate.used / (usageData.usage.story_generate.limit || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Story Continuations */}
                    <div>
                      <div className="flex justify-between text-xs mb-1 select-none">
                        <span className="text-slate-400 font-medium">Story Continuations</span>
                        <span className="text-slate-300 font-bold">
                          {usageData.usage.story_continue.used} / {usageData.usage.story_continue.limit === null || usageData.usage.story_continue.limit === Infinity ? "∞" : usageData.usage.story_continue.limit}
                        </span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-purple-500 h-1.5 rounded-full transition-all duration-500"
                          style={{
                            width: `${usageData.usage.story_continue.limit === null || usageData.usage.story_continue.limit === Infinity ? 0 : Math.min(100, (usageData.usage.story_continue.used / (usageData.usage.story_continue.limit || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {usageData.plan === "free" && (
                    <p className="text-[10px] text-indigo-400/80 mt-3 flex items-center gap-1 select-none">
                      <i className="fas fa-info-circle" />
                      Free quota resets on {new Date(usageData.resetsAt).toLocaleDateString()}.
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-2 w-full box-border">
                <button
                  type="button"
                  disabled={loading || isOverLimit}
                  aria-busy={loading}
                  aria-disabled={loading || isOverLimit}
                  onClick={handleGenerateClick}
                  className={`w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold py-3 px-6 rounded-xl shadow-md shadow-blue-500/10 transition-all duration-150 active:scale-[0.98] select-none uppercase tracking-wider flex items-center justify-center gap-2 ${
                    loading || isOverLimit ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                  } group`}
                >
                  <i className="fas fa-wand-magic-sparkles text-sm group-hover:scale-110 transition-transform duration-200" />
                  <span>{loading ? text.generating : text.generate}</span>
                </button>
              </div>
                </>
              )}
            </form>
          </div>

          <div className="w-full text-left box-border">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 select-none px-0.5">
              {text.examples}
            </h3>

            <div className="relative w-full" ref={dropdownRef}>
              <button
                type="button"
                onClick={handleToggleDropdown}
                className="w-full p-3.5 bg-white dark:bg-[#111827]/40 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:border-blue-500/30 flex items-center justify-between text-xs sm:text-sm font-medium text-left transition-all duration-150 cursor-pointer select-none shadow-sm"
              >
                <span className="truncate pr-4">
                  {selectedPrompt || text.selectPrompt}
                </span>
                <span className={`text-slate-400 dark:text-slate-500 text-[9px] transition-transform duration-150 shrink-0 ${isDropdownOpen ? "rotate-180" : ""}`}>
                  Γû╝
                </span>
              </button>

              {isDropdownOpen && (
                <ul className="absolute z-30 w-full mt-1.5 max-h-60 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl focus:outline-none divide-y divide-slate-100 dark:divide-white/5 p-1 box-border list-none m-0">
                  {prompts.map((item) => (
                    <li key={item.id} className="p-0 m-0 list-none">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPrompt(item.prompt);
                          setTextareaValue(item.prompt);
                          setIsDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 text-xs sm:text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors duration-150 whitespace-normal break-words leading-relaxed font-medium cursor-pointer"
                      >
                        {item.prompt}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Stories View */}
        <StoriesViewComponent
          stories={uniqueStories}
          isLogin={login}
          setStories={setStories}
          isLoading={loading}
        />

        {/* Help Modal */}
        {showHelpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full">
              <h2 className="text-xl font-bold text-white mb-4">{text.shortcuts}</h2>
              <div className="space-y-3 text-gray-300 text-sm">
                <div><kbd>?</kbd> {text.openHelp}</div>
                <div><kbd>Esc</kbd> {text.closeHelp}</div>
                <div><kbd>/</kbd> {text.focusPrompt}</div>
                <div><kbd>Ctrl + Enter</kbd> {text.generateStory}</div>
                <div><kbd>Ctrl + S</kbd> {text.publishStory}</div>
              </div>
              <button onClick={() => setShowHelpModal(false)} className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg">
                {text.close}
              </button>
            </div>
          </div>
        )}

        {/* Loading Animation */}
        {loading && <StoryGeneratingAnimation />}

        {/* Limit Modal */}
        {showLimitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#0f172a] border border-white/10 rounded-2xl shadow-[0_0_15px_rgba(59,130,246,0.5)] max-w-md w-full p-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-lock text-2xl text-blue-400"></i>
                </div>
                <h3 className="text-2xl font-bold text-gray-200 mb-2">{text.freeLimitReached}</h3>
                <p className="text-gray-400 mb-6 leading-relaxed">{text.freeLimitMessage}</p>
                <div className="flex flex-col gap-3">
                  <Link to="/login" className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/25">
                    {text.login}
                  </Link>
                  <button onClick={() => setShowLimitModal(false)} className="w-full bg-transparent hover:bg-white/5 text-gray-400 hover:text-gray-300 font-medium py-3 px-4 rounded-xl transition-all">
                    {text.continueBrowsing}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <Toaster position="top-right" reverseOrder={false} />
      </div>
    </div>
  );
};

// Default export
export default StoriesComponent;