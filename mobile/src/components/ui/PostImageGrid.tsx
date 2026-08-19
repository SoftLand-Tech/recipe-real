import { memo, useCallback, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemeColors } from "@/theme";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// ---- Fullscreen viewer ---------------------------------------------------------

interface ImageViewerProps {
  images: string[];
  startIndex?: number;
  onClose: () => void;
}

/**
 * Full-screen horizontal image pager (dark scrim, page-dot indicator).
 * Opened from PostImageGrid; self-contained via a Modal so it composites
 * above the rest of the UI without navigation overhead.
 *
 * Viewer fixes:
 *   - Images are CONTAINED (contentFit="contain") on a black background.
 *   - Close ✕ sits below the notch using safe-area top + 16 pt offset.
 *   - Position uses `start` (logical RTL-safe inset).
 *
 * Android paint rules: static styles only, no width:"100%" on any Pressable.
 */
export const ImageViewerModal = memo(function ImageViewerModal({
  images,
  startIndex = 0,
  onClose,
}: ImageViewerProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      const first = viewableItems[0];
      if (first?.index != null) {
        setCurrentIndex(first.index);
      }
    },
    [],
  );

  const viewabilityConfig = { viewAreaCoveragePercentThreshold: 50 };

  // Close button top: safe-area inset + 16 pt so it clears the notch/cutout.
  const closeBtnTop = insets.top + 16;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Dark scrim — tapping it closes the viewer. */}
      <TouchableWithoutFeedback onPress={onClose} accessible={false}>
        <View style={styles.scrim} />
      </TouchableWithoutFeedback>

      {/* Close button — start side (LTR=left, RTL=right), below notch. */}
      <View
        style={[styles.closeBtn, { top: closeBtnTop }]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={onClose}
          style={styles.closePressable}
          accessibilityLabel="Close"
          accessibilityRole="button"
        >
          <Ionicons name="close" size={24} color={colors.surface} />
        </Pressable>
      </View>

      {/* Paged image list — contained images on black pages. */}
      <FlatList
        ref={flatListRef}
        data={images}
        keyExtractor={(uri) => uri}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={startIndex}
        getItemLayout={(_, index) => ({
          length: SCREEN_W,
          offset: SCREEN_W * index,
          index,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => (
          <View style={styles.imagePage}>
            <Image
              source={{ uri: item }}
              style={styles.fullImage}
              contentFit="contain"
              transition={0}
              cachePolicy="memory-disk"
              recyclingKey={item}
            />
          </View>
        )}
        style={styles.pager}
        pointerEvents="box-none"
      />

      {/* Page-dot indicator */}
      {images.length > 1 ? (
        <View
          style={[styles.dotsRow, { bottom: insets.bottom + 20 }]}
          pointerEvents="none"
        >
          {images.map((uri, i) => (
            <View
              key={uri}
              style={[
                styles.dot,
                i === currentIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
      ) : null}
    </Modal>
  );
});

// ---- Image grid for feed cards and post detail --------------------------------

interface PostImageGridProps {
  images: string[];
  onImagePress?: (index: number) => void;
}

const GRID_GAP = 2;

/**
 * Facebook-style image grid layout:
 *   1 image  → full-width, 4:3 aspect.
 *   2 images → two equal halves side-by-side.
 *   3 images → one large on top (4:3), two halves below.
 *   4 images → 2×2 equal grid (square cells).
 *   5+ images→ 2×2 grid; last cell (index 3) shows the 4th image DIMMED with
 *               "+N" overlay where N = images.length − 4. Tapping the "+N"
 *               cell opens the fullscreen viewer at index 3; remaining images
 *               are reachable by swiping (Facebook behavior).
 *
 * Hairline 2 pt gaps between cells; outer corners rounded like cards.
 *
 * Android paint rules: no width:"100%" on Pressable; opacity feedback via state.
 */
export const PostImageGrid = memo(function PostImageGrid({
  images,
  onImagePress,
}: PostImageGridProps) {
  const colors = useThemeColors();
  const [pressedIndex, setPressedIndex] = useState<number | null>(null);

  if (images.length === 0) return null;

  const cellBg = colors.surfaceSoft;

  // ── 1 image: full-width 4:3 ──────────────────────────────────────────────
  if (images.length === 1) {
    return (
      <View style={gridStyles.singleContainer}>
        <Pressable
          onPress={() => onImagePress?.(0)}
          onPressIn={() => setPressedIndex(0)}
          onPressOut={() => setPressedIndex(null)}
          style={[
            gridStyles.singleCell,
            { backgroundColor: cellBg },
            pressedIndex === 0 ? gridStyles.pressed : null,
          ]}
          accessibilityRole="image"
        >
          <Image
            source={{ uri: images[0] }}
            style={gridStyles.fillImage}
            contentFit="cover"
            transition={0}
            cachePolicy="memory-disk"
            recyclingKey={images[0]}
          />
        </Pressable>
      </View>
    );
  }

  // ── 2 images: two side-by-side halves ─────────────────────────────────────
  if (images.length === 2) {
    return (
      <View style={gridStyles.doubleRow}>
        {images.map((uri, i) => (
          <Pressable
            key={uri}
            onPress={() => onImagePress?.(i)}
            onPressIn={() => setPressedIndex(i)}
            onPressOut={() => setPressedIndex(null)}
            style={[
              gridStyles.doubleCell,
              { backgroundColor: cellBg, marginLeft: i === 1 ? GRID_GAP : 0 },
              pressedIndex === i ? gridStyles.pressed : null,
            ]}
            accessibilityRole="image"
          >
            <Image
              source={{ uri }}
              style={gridStyles.fillImage}
              contentFit="cover"
              transition={0}
              cachePolicy="memory-disk"
              recyclingKey={uri}
            />
          </Pressable>
        ))}
      </View>
    );
  }

  // ── 3 images: one large on top + two halves below ────────────────────────
  if (images.length === 3) {
    return (
      <View style={gridStyles.tripleContainer}>
        <Pressable
          onPress={() => onImagePress?.(0)}
          onPressIn={() => setPressedIndex(0)}
          onPressOut={() => setPressedIndex(null)}
          style={[
            gridStyles.tripleTop,
            { backgroundColor: cellBg },
            pressedIndex === 0 ? gridStyles.pressed : null,
          ]}
          accessibilityRole="image"
        >
          <Image
            source={{ uri: images[0] }}
            style={gridStyles.fillImage}
            contentFit="cover"
            transition={0}
            cachePolicy="memory-disk"
            recyclingKey={images[0]}
          />
        </Pressable>
        <View style={gridStyles.tripleBottomRow}>
          <Pressable
            onPress={() => onImagePress?.(1)}
            onPressIn={() => setPressedIndex(1)}
            onPressOut={() => setPressedIndex(null)}
            style={[
              gridStyles.tripleBottomCell,
              { backgroundColor: cellBg },
              pressedIndex === 1 ? gridStyles.pressed : null,
            ]}
            accessibilityRole="image"
          >
            <Image
              source={{ uri: images[1] }}
              style={gridStyles.fillImage}
              contentFit="cover"
              transition={0}
              cachePolicy="memory-disk"
              recyclingKey={images[1]}
            />
          </Pressable>
          <Pressable
            onPress={() => onImagePress?.(2)}
            onPressIn={() => setPressedIndex(2)}
            onPressOut={() => setPressedIndex(null)}
            style={[
              gridStyles.tripleBottomCell,
              { backgroundColor: cellBg, marginLeft: GRID_GAP },
              pressedIndex === 2 ? gridStyles.pressed : null,
            ]}
            accessibilityRole="image"
          >
            <Image
              source={{ uri: images[2] }}
              style={gridStyles.fillImage}
              contentFit="cover"
              transition={0}
              cachePolicy="memory-disk"
              recyclingKey={images[2]}
            />
          </Pressable>
        </View>
      </View>
    );
  }

  // ── 4 images: 2×2 equal grid ─────────────────────────────────────────────
  if (images.length === 4) {
    const topRow = images.slice(0, 2);
    const botRow = images.slice(2, 4);
    return (
      <View style={gridStyles.quadContainer}>
        <View style={gridStyles.quadRow}>
          {topRow.map((uri, i) => (
            <Pressable
              key={uri}
              onPress={() => onImagePress?.(i)}
              onPressIn={() => setPressedIndex(i)}
              onPressOut={() => setPressedIndex(null)}
              style={[
                gridStyles.quadCell,
                { backgroundColor: cellBg, marginLeft: i === 1 ? GRID_GAP : 0 },
                pressedIndex === i ? gridStyles.pressed : null,
              ]}
              accessibilityRole="image"
            >
              <Image
                source={{ uri }}
                style={gridStyles.fillImage}
                contentFit="cover"
                transition={0}
                cachePolicy="memory-disk"
                recyclingKey={uri}
              />
            </Pressable>
          ))}
        </View>
        <View style={[gridStyles.quadRow, { marginTop: GRID_GAP }]}>
          {botRow.map((uri, i) => {
            const idx = 2 + i;
            return (
              <Pressable
                key={uri}
                onPress={() => onImagePress?.(idx)}
                onPressIn={() => setPressedIndex(idx)}
                onPressOut={() => setPressedIndex(null)}
                style={[
                  gridStyles.quadCell,
                  { backgroundColor: cellBg, marginLeft: i === 1 ? GRID_GAP : 0 },
                  pressedIndex === idx ? gridStyles.pressed : null,
                ]}
                accessibilityRole="image"
              >
                <Image
                  source={{ uri }}
                  style={gridStyles.fillImage}
                  contentFit="cover"
                  transition={0}
                  cachePolicy="memory-disk"
                  recyclingKey={uri}
                />
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  // ── 5+ images: 2×2 grid, last cell dimmed with "+N" overlay ──────────────
  const extraCount = images.length - 4;
  const topRow5 = images.slice(0, 2);
  const botRow5 = images.slice(2, 4);

  return (
    <View style={gridStyles.quadContainer}>
      <View style={gridStyles.quadRow}>
        {topRow5.map((uri, i) => (
          <Pressable
            key={uri}
            onPress={() => onImagePress?.(i)}
            onPressIn={() => setPressedIndex(i)}
            onPressOut={() => setPressedIndex(null)}
            style={[
              gridStyles.quadCell,
              { backgroundColor: cellBg, marginLeft: i === 1 ? GRID_GAP : 0 },
              pressedIndex === i ? gridStyles.pressed : null,
            ]}
            accessibilityRole="image"
          >
            <Image
              source={{ uri }}
              style={gridStyles.fillImage}
              contentFit="cover"
              transition={0}
              cachePolicy="memory-disk"
              recyclingKey={uri}
            />
          </Pressable>
        ))}
      </View>
      <View style={[gridStyles.quadRow, { marginTop: GRID_GAP }]}>
        {botRow5.map((uri, i) => {
          const idx = 2 + i;
          const isLast = i === 1;
          return (
            <Pressable
              key={uri}
              onPress={() => onImagePress?.(idx)}
              onPressIn={() => setPressedIndex(idx)}
              onPressOut={() => setPressedIndex(null)}
              style={[
                gridStyles.quadCell,
                { backgroundColor: cellBg, marginLeft: i === 1 ? GRID_GAP : 0 },
                pressedIndex === idx ? gridStyles.pressed : null,
              ]}
              accessibilityRole="image"
            >
              <Image
                source={{ uri }}
                style={gridStyles.fillImage}
                contentFit="cover"
                transition={0}
                cachePolicy="memory-disk"
                recyclingKey={uri}
              />
              {isLast ? (
                <View style={gridStyles.extraOverlay}>
                  <Text style={gridStyles.extraText}>+{extraCount}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

// ---- Compose preview grid (with remove buttons) --------------------------------

interface ComposeImageGridProps {
  uris: string[];
  onRemove: (index: number) => void;
  disabled?: boolean;
}

/**
 * Image preview grid for the compose screen. Mirrors PostImageGrid's layouts
 * (1/2/3/4/5+) and adds a small ✕ button on each cell to remove the photo.
 */
export const ComposeImageGrid = memo(function ComposeImageGrid({
  uris,
  onRemove,
  disabled = false,
}: ComposeImageGridProps) {
  const colors = useThemeColors();
  const cellBg = colors.surfaceSoft;

  if (uris.length === 0) return null;

  // ── 1 image ──────────────────────────────────────────────────────────────
  if (uris.length === 1) {
    return (
      <View style={gridStyles.singleContainer}>
        <View style={[gridStyles.singleCell, { backgroundColor: cellBg }]}>
          <Image
            source={{ uri: uris[0] }}
            style={gridStyles.fillImage}
            contentFit="cover"
            transition={0}
          />
          <RemoveBtn onPress={() => onRemove(0)} disabled={disabled} colors={colors} />
        </View>
      </View>
    );
  }

  // ── 2 images ─────────────────────────────────────────────────────────────
  if (uris.length === 2) {
    return (
      <View style={gridStyles.doubleRow}>
        {uris.map((uri, i) => (
          <View
            key={`compose-${i}`}
            style={[
              gridStyles.doubleCell,
              { backgroundColor: cellBg, marginLeft: i === 1 ? GRID_GAP : 0 },
            ]}
          >
            <Image source={{ uri }} style={gridStyles.fillImage} contentFit="cover" transition={0} />
            <RemoveBtn onPress={() => onRemove(i)} disabled={disabled} colors={colors} />
          </View>
        ))}
      </View>
    );
  }

  // ── 3 images: top large + 2 halves below ─────────────────────────────────
  if (uris.length === 3) {
    return (
      <View style={gridStyles.tripleContainer}>
        <View style={[gridStyles.tripleTop, { backgroundColor: cellBg }]}>
          <Image source={{ uri: uris[0] }} style={gridStyles.fillImage} contentFit="cover" transition={0} />
          <RemoveBtn onPress={() => onRemove(0)} disabled={disabled} colors={colors} />
        </View>
        <View style={gridStyles.tripleBottomRow}>
          {uris.slice(1, 3).map((uri, i) => (
            <View
              key={`compose-r${i}`}
              style={[
                gridStyles.tripleBottomCell,
                { backgroundColor: cellBg, marginLeft: i === 1 ? GRID_GAP : 0 },
              ]}
            >
              <Image source={{ uri }} style={gridStyles.fillImage} contentFit="cover" transition={0} />
              <RemoveBtn onPress={() => onRemove(i + 1)} disabled={disabled} colors={colors} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  // ── 4 images: 2×2 ────────────────────────────────────────────────────────
  if (uris.length === 4) {
    const topRow = uris.slice(0, 2);
    const botRow = uris.slice(2, 4);
    return (
      <View style={gridStyles.quadContainer}>
        <View style={gridStyles.quadRow}>
          {topRow.map((uri, i) => (
            <View
              key={`compose-t${i}`}
              style={[gridStyles.quadCell, { backgroundColor: cellBg, marginLeft: i === 1 ? GRID_GAP : 0 }]}
            >
              <Image source={{ uri }} style={gridStyles.fillImage} contentFit="cover" transition={0} />
              <RemoveBtn onPress={() => onRemove(i)} disabled={disabled} colors={colors} />
            </View>
          ))}
        </View>
        <View style={[gridStyles.quadRow, { marginTop: GRID_GAP }]}>
          {botRow.map((uri, i) => {
            const idx = 2 + i;
            return (
              <View
                key={`compose-b${i}`}
                style={[gridStyles.quadCell, { backgroundColor: cellBg, marginLeft: i === 1 ? GRID_GAP : 0 }]}
              >
                <Image source={{ uri }} style={gridStyles.fillImage} contentFit="cover" transition={0} />
                <RemoveBtn onPress={() => onRemove(idx)} disabled={disabled} colors={colors} />
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  // ── 5+ images: 2×2, last cell with +N ────────────────────────────────────
  const extraCount = uris.length - 4;
  const topRow5 = uris.slice(0, 2);
  const botRow5 = uris.slice(2, 4);
  return (
    <View style={gridStyles.quadContainer}>
      <View style={gridStyles.quadRow}>
        {topRow5.map((uri, i) => (
          <View
            key={`compose-t5${i}`}
            style={[gridStyles.quadCell, { backgroundColor: cellBg, marginLeft: i === 1 ? GRID_GAP : 0 }]}
          >
            <Image source={{ uri }} style={gridStyles.fillImage} contentFit="cover" transition={0} />
            <RemoveBtn onPress={() => onRemove(i)} disabled={disabled} colors={colors} />
          </View>
        ))}
      </View>
      <View style={[gridStyles.quadRow, { marginTop: GRID_GAP }]}>
        {botRow5.map((uri, i) => {
          const idx = 2 + i;
          const isLast = i === 1;
          return (
            <View
              key={`compose-b5${i}`}
              style={[gridStyles.quadCell, { backgroundColor: cellBg, marginLeft: i === 1 ? GRID_GAP : 0 }]}
            >
              <Image source={{ uri }} style={gridStyles.fillImage} contentFit="cover" transition={0} />
              <RemoveBtn onPress={() => onRemove(idx)} disabled={disabled} colors={colors} />
              {isLast ? (
                <View style={gridStyles.extraOverlay}>
                  <Text style={gridStyles.extraText}>+{extraCount}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
});

// ---- Small remove button -------------------------------------------------------

function RemoveBtn({
  onPress,
  disabled,
  colors,
}: {
  onPress: () => void;
  disabled: boolean;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      accessibilityLabel="Remove photo"
      accessibilityRole="button"
      style={[
        removeBtnStyles.btn,
        { backgroundColor: colors.surface },
        pressed ? removeBtnStyles.pressed : null,
      ]}
    >
      <Ionicons name="close" size={14} color={colors.ink} />
    </Pressable>
  );
}

// ---- Styles -------------------------------------------------------------------

const SINGLE_HEIGHT = 220;
const DOUBLE_HEIGHT = 180;
const TRIPLE_TOP_HEIGHT = 160;
const TRIPLE_BOTTOM_HEIGHT = 120;
// Quad: square cells — (screen width − card horizontal padding − 1 gap) / 2
// Card padding = 2 * Space.lg (≈2*16=32). SCREEN_W approx only for style const.
const QUAD_CELL_SIZE = Math.floor((SCREEN_W - 32 - GRID_GAP) / 2);

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#000",
  },
  closeBtn: {
    position: "absolute",
    // Logical start (left in LTR, right in RTL) — RTL-safe.
    start: 16,
    zIndex: 10,
  },
  closePressable: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  pager: {
    flex: 1,
  },
  imagePage: {
    width: SCREEN_W,
    height: SCREEN_H,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  fullImage: {
    width: SCREEN_W,
    height: SCREEN_H,
  },
  dotsRow: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    zIndex: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: "#fff",
  },
  dotInactive: {
    backgroundColor: "rgba(255,255,255,0.4)",
  },
});

const gridStyles = StyleSheet.create({
  // ── 1 image ──────────────────────────────────────────────────────────────
  singleContainer: {
    borderRadius: 8,
    overflow: "hidden",
  },
  singleCell: {
    height: SINGLE_HEIGHT,
  },
  // ── 2 images ─────────────────────────────────────────────────────────────
  doubleRow: {
    flexDirection: "row",
    borderRadius: 8,
    overflow: "hidden",
    height: DOUBLE_HEIGHT,
  },
  doubleCell: {
    flex: 1,
  },
  // ── 3 images: top large + 2 halves below ─────────────────────────────────
  tripleContainer: {
    borderRadius: 8,
    overflow: "hidden",
  },
  tripleTop: {
    height: TRIPLE_TOP_HEIGHT,
  },
  tripleBottomRow: {
    flexDirection: "row",
    marginTop: GRID_GAP,
    height: TRIPLE_BOTTOM_HEIGHT,
  },
  tripleBottomCell: {
    flex: 1,
  },
  // ── 4+ images: 2×2 grid ───────────────────────────────────────────────────
  quadContainer: {
    borderRadius: 8,
    overflow: "hidden",
  },
  quadRow: {
    flexDirection: "row",
    height: QUAD_CELL_SIZE,
  },
  quadCell: {
    flex: 1,
  },
  // ── Shared ───────────────────────────────────────────────────────────────
  fillImage: {
    ...StyleSheet.absoluteFill,
  },
  pressed: {
    opacity: 0.75,
  },
  extraOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  extraText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
  },
});

const removeBtnStyles = StyleSheet.create({
  btn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  pressed: {
    opacity: 0.6,
  },
});
