import { StyleSheet } from "react-native";

export const colors = {
  bg: "#07080A",
  ink: "#F2F4F6",
  muted: "#A9B1BB",
  dim: "#7C8590",
  line: "rgba(255,255,255,0.08)",
  card: "#101216",
  ok: "#86EFAC",
  watch: "#F7C873",
  alert: "#FF8A80",
  gold: "#F2B544",
  blue: "#9ED0FF",
  green: "#3EE887",
  ledBlue: "#5AA8FF",
  ledYellow: "#F0D04A",
  ledRed: "#FF6B6B",
};

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  stage: { flex: 1 },
});
