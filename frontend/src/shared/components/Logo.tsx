import autouLogoWhite from "../../assets/brand/logo-autou-white.svg";
import styles from "./Logo.module.css";

/** Marca do produto (Logos) com a assinatura de quem o constrói (AutoU). */
export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span className={`${styles.logo} ${styles[size]}`}>
      <span className={styles.mark} aria-hidden="true" />
      <span className={styles.wordmark}>Logos</span>
      <span className={styles.signature}>
        <span className="visually-hidden">por AutoU</span>
        <img src={autouLogoWhite} alt="" className={styles.autou} />
      </span>
    </span>
  );
}
