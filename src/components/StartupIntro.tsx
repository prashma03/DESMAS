import { useEventListener } from "expo";
import { useVideoPlayer, VideoView, type VideoPlayer } from "expo-video";
import { useEffect, useRef, useState } from "react";
import { Animated, AppState, Easing, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { advanceIntro, type IntroAdvance, type IntroPhase } from "../introSession";

const VIDEO_1 = require("../../assets/Videoes/vid-1.mp4") as number;
const VIDEO_2 = require("../../assets/Videoes/vid-2.mp4") as number;

function silenceMedia() {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  document.querySelectorAll("video, audio").forEach((node) => {
    if (!(node instanceof HTMLMediaElement)) return;
    node.loop = false;
    node.muted = true;
    node.volume = 0;
    try {
      node.pause();
    } catch {
      // A detached element can throw.
    }
  });
}

silenceMedia();

const sans = Platform.OS === "web" ? "Geist, sans-serif" : undefined;
const REVEAL_MS = 720;
const READY_WAIT_MS = 900;
const LOAD_GIVE_UP_MS = 8000;

type Props = {
  onComplete: () => void;
};

export function StartupIntro({ onComplete }: Props) {
  const [phase, setPhase] = useState<IntroPhase>("video1");
  const [showSecond, setShowSecond] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const phaseRef = useRef<IntroPhase>("video1");
  const finished = useRef(false);
  const playingRef = useRef(false);
  const gestureRef = useRef(false);
  const frameReady = useRef(false);
  const revealed = useRef(false);
  const autoPlayed = useRef(false);
  const playedOnce = useRef(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const player1 = useVideoPlayer(VIDEO_1, preparePlayer);
  const player2 = useVideoPlayer(VIDEO_2, preparePlayer);

  useEffect(() => {
    pause(player1);
    pause(player2);
    silenceMedia();
    if (!finished.current) {
      finished.current = true;
      onCompleteRef.current();
    }
  }, [player1, player2]);
  const player1Ref = useRef(player1);
  const player2Ref = useRef(player2);
  player1Ref.current = player1;
  player2Ref.current = player2;

  const reveal = () => {
    if (finished.current) return;
    finished.current = true;
    phaseRef.current = "complete";
    pause(player1Ref.current);
    pause(player2Ref.current);
    const duration = revealDuration();
    const finish = () => {
      if (revealed.current) return;
      revealed.current = true;
      onCompleteRef.current();
    };
    const backup = setTimeout(finish, duration + 180);
    Animated.timing(opacity, {
      toValue: 0,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      clearTimeout(backup);
      finish();
    });
  };

  const goRef = useRef<(reason: IntroAdvance) => void>(() => {});
  goRef.current = (reason) => {
    if (finished.current) return;
    const next = advanceIntro(phaseRef.current, reason);
    if (next === "complete") {
      reveal();
      return;
    }
    if (next === phaseRef.current) return;
    phaseRef.current = next;
    playingRef.current = false;
    gestureRef.current = false;
    autoPlayed.current = false;
    playedOnce.current = false;
    setNeedsGesture(false);
    setPhase(next);
  };

  useEventListener(player1, "playToEnd", () => {
    if (phaseRef.current === "video1") goRef.current("end");
  });
  useEventListener(player2, "playToEnd", () => {
    if (phaseRef.current === "video2") goRef.current("end");
  });
  const startRef = useRef<(player: VideoPlayer) => void>(() => {});
  startRef.current = (player) => {
    if (finished.current || autoPlayed.current || gestureRef.current) return;
    if (player.status === "error") {
      goRef.current("error");
      return;
    }
    if (player.status !== "readyToPlay") return;
    autoPlayed.current = true;
    tryPlay(player);
  };

  useEventListener(player1, "statusChange", ({ status }) => {
    if (phaseRef.current !== "video1") return;
    if (status === "error") goRef.current("error");
    else if (status === "readyToPlay") startRef.current(player1Ref.current);
  });
  useEventListener(player2, "statusChange", ({ status }) => {
    if (phaseRef.current !== "video2") return;
    if (status === "error") goRef.current("error");
    else if (status === "readyToPlay") startRef.current(player2Ref.current);
  });
  useEventListener(player1, "playingChange", ({ isPlaying }) => {
    if (phaseRef.current !== "video1") return;
    playingRef.current = isPlaying;
    if (isPlaying) {
      playedOnce.current = true;
      gestureRef.current = false;
      setNeedsGesture(false);
    }
  });
  useEventListener(player2, "playingChange", ({ isPlaying }) => {
    if (phaseRef.current !== "video2") return;
    playingRef.current = isPlaying;
    if (isPlaying) {
      playedOnce.current = true;
      gestureRef.current = false;
      setNeedsGesture(false);
    }
  });

  useEffect(() => {
    if (phase !== "video1" && phase !== "video2") return;
    const player = phase === "video1" ? player1 : player2;
    const other = phase === "video1" ? player2 : player1;
    pause(other);
    playingRef.current = false;
    autoPlayed.current = false;
    playedOnce.current = false;
    if (player.status === "error") {
      goRef.current("error");
      return;
    }
    startRef.current(player);
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (finished.current || phaseRef.current !== phase) return;
      if (player.status === "error") {
        goRef.current("error");
        return;
      }
      if (!autoPlayed.current) startRef.current(player);
      if (playingRef.current || playedOnce.current) return;
      const elapsed = Date.now() - startedAt;
      if (autoPlayed.current && player.status === "readyToPlay" && elapsed > READY_WAIT_MS) {
        gestureRef.current = true;
        setNeedsGesture(true);
        return;
      }
      if (elapsed > LOAD_GIVE_UP_MS && player.status !== "readyToPlay") goRef.current("error");
    }, 200);
    return () => clearInterval(timer);
  }, [phase, player1, player2]);

  useEffect(() => {
    if (phase !== "video2") return;
    if (frameReady.current) {
      setShowSecond(true);
      return;
    }
    const timer = setTimeout(() => setShowSecond(true), 280);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (!showSecond) return;
    const frame = requestAnimationFrame(() => unload(player1));
    return () => cancelAnimationFrame(frame);
  }, [showSecond, player1]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active" || finished.current || gestureRef.current) return;
      const current = phaseRef.current === "video1" ? player1Ref.current : phaseRef.current === "video2" ? player2Ref.current : null;
      if (current && !current.playing) tryPlay(current);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const hideCursor = () => {
      document.querySelectorAll("[data-desmas-comet-cursor='1']").forEach((node) => {
        if (node instanceof HTMLElement) node.style.visibility = "hidden";
      });
    };
    const markVideos = () => {
      document.querySelectorAll("video").forEach((video) => {
        video.preload = "auto";
        video.controls = false;
        video.playsInline = true;
      });
    };
    hideCursor();
    markVideos();
    const observer = new MutationObserver(() => {
      hideCursor();
      markVideos();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      document.querySelectorAll("[data-desmas-comet-cursor='1']").forEach((node) => {
        if (node instanceof HTMLElement) node.style.visibility = "";
      });
    };
  }, []);

  const activePlayer = phase === "video2" ? player2 : player1;

  return (
    <Animated.View accessibilityViewIsModal pointerEvents="auto" style={[styles.fill, { opacity }]}>
      <View pointerEvents="none" style={styles.layer}>
        <VideoView
          player={player2}
          style={styles.video}
          contentFit="contain"
          nativeControls={false}
          playsInline
          allowsFullscreen={false}
          allowsPictureInPicture={false}
          surfaceType="textureView"
          onFirstFrameRender={() => {
            frameReady.current = true;
            if (phaseRef.current === "video2") setShowSecond(true);
          }}
        />
      </View>
      <View pointerEvents="none" style={[styles.layer, showSecond ? styles.covered : null]}>
        <VideoView
          player={player1}
          style={styles.video}
          contentFit="contain"
          nativeControls={false}
          playsInline
          allowsFullscreen={false}
          allowsPictureInPicture={false}
          surfaceType="textureView"
        />
      </View>
      {needsGesture ? (
        <View pointerEvents="box-none" style={styles.playWrap}>
          <Pressable
            accessibilityLabel="Play intro"
            onPress={() => {
              gestureRef.current = false;
              setNeedsGesture(false);
              tryPlay(activePlayer);
            }}
            style={styles.play}
          >
            <Text style={styles.playTxt}>Play</Text>
          </Pressable>
        </View>
      ) : null}
      <Pressable accessibilityLabel="Skip intro" onPress={() => goRef.current("skip")} style={styles.skip}>
        <Text style={styles.skipTxt}>Skip intro</Text>
      </Pressable>
    </Animated.View>
  );
}

function preparePlayer(player: VideoPlayer) {
  player.loop = false;
  player.muted = true;
  player.volume = 0;
  player.staysActiveInBackground = false;
}

function tryPlay(player: VideoPlayer) {
  player.loop = false;
  player.muted = true;
  player.volume = 0;
  pause(player);
}

function pause(player: VideoPlayer) {
  try {
    player.pause();
  } catch {
    // Released players throw.
  }
}

function unload(player: VideoPlayer) {
  pause(player);
  const pending = player.replaceAsync(null);
  void Promise.resolve(pending).catch(() => {
    // The view may already have released the source.
  });
}

function revealDuration() {
  if (Platform.OS === "web" && typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 160;
  return REVEAL_MS;
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    backgroundColor: "#000",
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    backgroundColor: "#000",
  },
  covered: { opacity: 0 },
  video: {
    width: "100%",
    height: "100%",
    backgroundColor: "#000",
  },
  playWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  play: {
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 10,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  playTxt: {
    color: "#fff",
    fontFamily: sans,
    fontSize: 15,
    letterSpacing: 0.6,
  },
  skip: {
    position: "absolute",
    zIndex: 3,
    right: 22,
    bottom: 22,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  skipTxt: {
    color: "rgba(255,255,255,0.86)",
    fontFamily: sans,
    fontSize: 13,
    letterSpacing: 0.4,
  },
});
