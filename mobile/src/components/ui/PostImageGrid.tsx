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

const { width: SCREEN_W } = Dimensions.get("window");

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

      {/* Close button */}
      <View
        style={[styles.closeBtn, { top: insets.top + 12 }]}
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

      {/* Paged image list */}
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
 * Grid layout for 1, 2, or 3+ images:
 *   1 image  → full-width, 4:3 aspect (≈220 px)
 *   2 images → side-by-side, equal width, square cells
 *   3 images → left cell full height, right column stacks 2 cells
 *   4–6      → same as 3+ using a 2-column grid, first cell spans
 *
 * Android paint rules: no width:"100%" on Pressable — use explicit numeric
 * sizing or flex instead; opacity press feedback via onPressIn/Out.
 */
export const PostImageGrid = memo(function PostImageGrid({
  images,
  onImagePress,
}: PostImageGridProps) {
  const colors = useThemeColors();
  const [pressedIndex, setPressedIndex] = useState<number | null>(null);

  if (images.length === 0) return null;

  const cellBg = colors.surfaceSoft;

  // ---- 1 image ---------------------------------------------------------------
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

  // ---- 2 images --------------------------------------------------------------
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

  // ---- 3+ images: left spans full height, right stacks top + bottom ----------
  const leftUri = images[0];
  const rightTop = images[1];
  const rightBottom = images[2];
  // Remaining count indicator (4th+ images hidden behind the overlay).
  const extraCount = images.length > 3 ? images.length - 3 : 0;

  return (
    <View style={gridStyles.tripleContainer}>
      {/* Left cell (full height) */}
      <Pressable
        onPress={() => onImagePress?.(0)}
        onPressIn={() => setPressedIndex(0)}
        onPressOut={() => setPressedIndex(null)}
        style={[
          gridStyles.tripleLeft,
          { backgroundColor: cellBg },
          pressedIndex === 0 ? gridStyles.pressed : null,
        ]}
        accessibilityRole="image"
      >
        <Image
          source={{ uri: leftUri }}
          style={gridStyles.fillImage}
          contentFit="cover"
          transition={0}
          cachePolicy="memory-disk"
          recyclingKey={leftUri}
        />
      </Pressable>

      {/* Right column */}
      <View style={gridStyles.tripleRight}>
        {/* Top-right */}
        <Pressable
          onPress={() => onImagePress?.(1)}
          onPressIn={() => setPressedIndex(1)}
          onPressOut={() => setPressedIndex(null)}
          style={[
            gridStyles.tripleRightCell,
            { backgroundColor: cellBg, marginBottom: GRID_GAP },
            pressedIndex === 1 ? gridStyles.pressed : null,
          ]}
          accessibilityRole="image"
        >
          <Image
            source={{ uri: rightTop }}
            style={gridStyles.fillImage}
            contentFit="cover"
            transition={0}
            cachePolicy="memory-disk"
            recyclingKey={rightTop}
          />
        </Pressable>

        {/* Bottom-right (with +N overlay when more than 3 images) */}
        <Pressable
          onPress={() => onImagePress?.(2)}
          onPressIn={() => setPressedIndex(2)}
          onPressOut={() => setPressedIndex(null)}
          style={[
            gridStyles.tripleRightCell,
            { backgroundColor: cellBg },
            pressedIndex === 2 ? gridStyles.pressed : null,
          ]}
          accessibilityRole="image"
        >
          <Image
            source={{ uri: rightBottom }}
            style={gridStyles.fillImage}
            contentFit="cover"
            transition={0}
            cachePolicy="memory-disk"
            recyclingKey={rightBottom}
          />
          {extraCount > 0 ? (
            <View style={gridStyles.extraOverlay}>
              <Text style={gridStyles.extraText}>+{extraCount}</Text>
            </View>
          ) : null}
        </Pressable>
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
 * Image preview grid for the compose card. Mirrors PostImageGrid's layouts
 * and adds a small ✕ button on each cell to remove the photo.
 */
export const ComposeImageGrid = memo(function ComposeImageGrid({
  uris,
  onRemove,
  disabled = false,
}: ComposeImageGridProps) {
  const colors = useThemeColors();
  const cellBg = colors.surfaceSoft;

  if (uris.length === 0) return null;

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
          <RemoveBtn
            onPress={() => onRemove(0)}
            disabled={disabled}
            colors={colors}
          />
        </View>
      </View>
    );
  }

  if (uris.length === 2) {
    return (
      <View style={gridStyles.doubleRow}>
        {uris.map((uri, i) => (
          <View
            key={`compose-${i}`}
            style={[
              gridStyles.doubleCell,
              {
                backgroundColor: cellBg,
                marginLeft: i === 1 ? GRID_GAP : 0,
              },
            ]}
          >
            <Image
              source={{ uri }}
              style={gridStyles.fillImage}
              contentFit="cover"
              transition={0}
            />
            <RemoveBtn
              onPress={() => onRemove(i)}
              disabled={disabled}
              colors={colors}
            />
          </View>
        ))}
      </View>
    );
  }

  // 3+: same 2-column grid as PostImageGrid
  return (
    <View style={gridStyles.tripleContainer}>
      <View style={[gridStyles.tripleLeft, { backgroundColor: cellBg }]}>
        <Image
          source={{ uri: uris[0] }}
          style={gridStyles.fillImage}
          contentFit="cover"
          transition={0}
        />
        <RemoveBtn
          onPress={() => onRemove(0)}
          disabled={disabled}
          colors={colors}
        />
      </View>
      <View style={gridStyles.tripleRight}>
        {uris.slice(1, 3).map((uri, i) => (
          <View
            key={`compose-r${i}`}
            style={[
              gridStyles.tripleRightCell,
              {
                backgroundColor: cellBg,
                marginBottom: i === 0 ? GRID_GAP : 0,
              },
            ]}
          >
            <Image
              source={{ uri }}
              style={gridStyles.fillImage}
              contentFit="cover"
              transition={0}
            />
            <RemoveBtn
              onPress={() => onRemove(i + 1)}
              disabled={disabled}
              colors={colors}
            />
            {/* +N overlay for hidden images */}
            {i === 1 && uris.length > 3 ? (
              <View style={gridStyles.extraOverlay}>
                <Text style={gridStyles.extraText}>+{uris.length - 3}</Text>
              </View>
            ) : null}
          </View>
        ))}
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
const TRIPLE_HEIGHT = 200;

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.9)",
  },
  closeBtn: {
    position: "absolute",
    right: 16,
    zIndex: 10,
  },
  closePressable: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  pager: {
    flex: 1,
  },
  imagePage: {
    width: SCREEN_W,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  fullImage: {
    width: SCREEN_W,
    flex: 1,
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
  singleContainer: {
    borderRadius: 8,
    overflow: "hidden",
  },
  singleCell: {
    height: SINGLE_HEIGHT,
  },
  doubleRow: {
    flexDirection: "row",
    borderRadius: 8,
    overflow: "hidden",
    height: DOUBLE_HEIGHT,
  },
  doubleCell: {
    flex: 1,
  },
  tripleContainer: {
    flexDirection: "row",
    borderRadius: 8,
    overflow: "hidden",
    height: TRIPLE_HEIGHT,
  },
  tripleLeft: {
    flex: 1,
    marginRight: GRID_GAP,
  },
  tripleRight: {
    flex: 1,
    flexDirection: "column",
  },
  tripleRightCell: {
    flex: 1,
  },
  fillImage: {
    ...StyleSheet.absoluteFill,
  },
  pressed: {
    opacity: 0.75,
  },
  extraOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  extraText: {
    color: "#fff",
    fontSize: 20,
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
