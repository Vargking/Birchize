import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { Icon, Logo } from "./Icons";
import type { IconName } from "./Icons";
const KEY = "birchize-onboarding-v1";
export default function Tutorial() {
  const { t } = useI18n();
  const [open, setOpen] = useState(() => {
      try {
        return localStorage.getItem(KEY) !== "seen";
      } catch {
        return true;
      }
    }),
    [step, setStep] = useState(0);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) {
      ref.current?.showModal();
      try {
        localStorage.setItem(KEY, "seen");
      } catch {}
    } else ref.current?.close();
  }, [open]);
  const steps: { icon: IconName; title: string; desc: string }[] = [
    { icon: "shield", title: "tutorialWelcome", desc: "tutorialPrivacy" },
    { icon: "upload", title: "tutorialUpload", desc: "tutorialUploadDesc" },
    {
      icon: "settings",
      title: "tutorialSettings",
      desc: "tutorialSettingsDesc",
    },
    { icon: "download", title: "tutorialSave", desc: "tutorialSaveDesc" },
  ];
  return (
    <dialog
      ref={ref}
      className="tutorial-dialog"
      onCancel={() => setOpen(false)}
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      aria-labelledby="tutorial-title"
    >
      <div className="tutorial-top">
        <span className="tutorial-brand">
          <Logo size={29} />
          <b>Birchize</b>
        </span>
        <button
          className="icon-button"
          onClick={() => setOpen(false)}
          aria-label={t("close")}
        >
          <Icon name="close" size={18} />
        </button>
      </div>
      <div className="tutorial-illustration">
        <div className="tutorial-orbit" />
        <div className="tutorial-orbit second" />
        <div className="tutorial-center-icon" key={step}>
          <Icon name={steps[step].icon} size={40} />
        </div>
        <span className="tutorial-chip left">
          {step === 0
            ? "100% LOCAL"
            : step === 1
              ? "JPG + MP4"
              : step === 2
                ? "≤ 200 KB"
                : "READY ✓"}
        </span>
        <span className="tutorial-chip right">
          {step === 0
            ? "NO UPLOAD"
            : step === 1
              ? "MULTI-FILE"
              : step === 2
                ? "PNG → JPG"
                : "DOWNLOAD"}
        </span>
      </div>
      <span className="tutorial-eyebrow">
        A GENTLE INTRODUCTION · 0{step + 1}/04
      </span>
      <h2 id="tutorial-title">{t(steps[step].title)}</h2>
      <p>{t(steps[step].desc)}</p>
      <div className="tutorial-dots">
        {steps.map((_, i) => (
          <button
            key={i}
            className={i === step ? "active" : ""}
            onClick={() => setStep(i)}
            aria-label={`${i + 1}/4`}
          />
        ))}
      </div>
      <div className="tutorial-actions">
        <button
          className="text-button"
          onClick={() => (step ? setStep(step - 1) : setOpen(false))}
        >
          {t(step ? "back" : "skip")}
        </button>
        <button
          className="button primary"
          onClick={() => (step === 3 ? setOpen(false) : setStep(step + 1))}
        >
          {t(step === 3 ? "start" : "next")}
          <Icon name="arrow" size={16} />
        </button>
      </div>
      <small className="tutorial-once">{t("tutorialOnce")}</small>
    </dialog>
  );
}
