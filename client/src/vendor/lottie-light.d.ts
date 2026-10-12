// lottie-web 5.13.0, SVG light build; MIT license is included alongside the source.
export interface LottieAnimation {
  isLoaded: boolean; totalFrames: number;
  play(): void; goToAndStop(frame: number, isFrame: boolean): void; destroy(): void;
  addEventListener(name: string, callback: () => void): void;
  removeEventListener(name: string, callback: () => void): void;
}
declare const lottie: {
  loadAnimation(options: {
    container: HTMLElement; renderer: "svg"; loop: boolean; autoplay: boolean;
    animationData: unknown; rendererSettings: { preserveAspectRatio: string };
  }): LottieAnimation;
};
export default lottie;
