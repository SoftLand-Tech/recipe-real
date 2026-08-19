import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Image as RNImage,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Image, type ImageLoadEventData } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Radius, type ThemeColors, useThemeColors } from "@/theme";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

/** Vertical distance/velocity that commits a swipe-down dismiss. */
const DISMISS_DRAG = 110;
const DISMISS_VY = 1.1;

/** Floating card layout tokens */
const CARD_MARGIN_H = 16;
const CARD_MARGIN_V = 20;
const CARD_PADDING = 10;
const CARD_RADIUS = Radius.lg; // 16
const CARD_IMAGE_RADIUS = Radius.sm; // 8

// ---- Fullscreen viewer ---------------------------------------------------------

interface ImageViewerProps {
  images: string[];
  startIndex?: number;
  onClose: () => void;
}

interface ViewerCardPageProps {
  uri: string;
  insets: { top: number; bottom: number; left: number; right: number };
  colors: ThemeColors;
  onClose: () => void;
}

/**
 * Individual page inside the photo viewer FlatList:
 * Measures intrinsic photo dimensions and renders a floating rounded card
 * that wraps the contained image with padding and margins.
 */
const ViewerCardPage = memo(function ViewerCardPage({
  uri,
  insets,
  colors,
  onClose,
}: ViewerCardPageProps) {
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    let active = true;
    if (uri) {
      RNImage.getSize(
        uri,
        (width, height) => {
          if (active && width > 0 && height > 0) {
            setDimensions((prev) => prev ?? { width, height });
          }
        },
        () => {
          // Handled via expo-image onLoad fallback
        },
      );
    }
    return () => {
      active = false;
    };
  }, [uri]);

  const handleLoad = useCallback((event: ImageLoadEventData) => {
    const { width, height } = event.source;
    if (width > 0 && height > 0) {
      setDimensions({ width, height });
    }
  }, []);

  // Compute safe boundaries taking notch, chrome row, and margins into account
  const safeTop = insets.top + 56;
  const safeBottom = Math.max(insets.bottom, 16);
  const maxImageW = Math.max(100, SCREEN_W - 2 * CARD_MARGIN_H - 2 * CARD_PADDING);
  const maxImageH = Math.max(100, SCREEN_H - safeTop - safeBottom - 2 * CARD_MARGIN_V - 2 * CARD_PADDING);

  let imageW = maxImageW;
  let imageH = maxImageH;

  if (dimensions && dimensions.width > 0 && dimensions.height > 0) {
    const aspectRatio = dimensions.width / dimensions.height;
    const maxAspectRatio = maxImageW / maxImageH;

    if (aspectRatio >= maxAspectRatio) {
      imageW = maxImageW;
      imageH = Math.round(maxImageW / aspectRatio);
    } else {
      imageH = maxImageH;
      imageW = Math.round(maxImageH * aspectRatio);
    }
  }

  const cardW = imageW + 2 * CARD_PADDING;
  const cardH = imageH + 2 * CARD_PADDING;

  return (
    <View style={styles.imagePage}>
      {/* Tapping empty scrim area outside the card closes the viewer */}
      <TouchableWithoutFeedback onPress={onClose} accessible={false}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>

      {/* Floating card wrapping the photo */}
      <TouchableWithoutFeedback onPress={() => {}} accessible={false}>
        <View
          style={[
            styles.card,
            {
              width: cardW,
              height: cardH,
              backgroundColor: colors.surface,
            },
          ]}
        >
          <Image
            source={{ uri }}
            style={[styles.cardImage, { width: imageW, height: imageH }]}
            contentFit={dimensions ? "cover" : "contain"}
            transition={0}
            cachePolicy="memory-disk"
            recyclingKey={uri}
            onLoad={handleLoad}
          />
        </View>
      </TouchableWithoutFeedback>
    </View>
  );
});

/**
 * Facebook-style fullscreen photo viewer:
 *   - opens with a zoom-in feel (photo card scales up from 0.85 + scrim fades in)
 *   - photo rendered in a rounded floating CARD (colors.surface, inner padding, drop shadow)
 *   - card dimensions wrap the photo's intrinsic aspect ratio within safe screen margins
 *   - horizontal paging between photos with an "N / M" counter
 *   - SWIPE DOWN to dismiss (card tracks the finger, scrim fades proportionally)
 *   - tapping dimmed scrim outside card closes viewer
 *   - chrome ✕ and counter float on the scrim above the card
 *
 * Self-contained via a Modal — composites above the UI without navigation.
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

  // Entry animation: scrim fade + photo scale-up (the FB "zoom into place").
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const contentScale = useRef(new Animated.Value(0.85)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(scrimOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(contentScale, {
        toValue: 1,
        speed: 20,
        bounciness: 5,
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swipe-down-to-dismiss: the pager wrapper tracks a downward drag and the
  // scrim fades proportionally. Only claims the gesture when the movement is
  // clearly VERTICAL (dy dominates dx), so horizontal paging still works.
  const panY = useRef(new Animated.Value(0)).current;
  const dragOffsetRef = useRef(0);
  const closingRef = useRef(false);
  const runDismiss = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    Animated.parallel([
      Animated.timing(panY, {
        toValue: SCREEN_H,
        duration: 170,
        useNativeDriver: true,
      }),
      Animated.timing(scrimOpacity, {
        toValue: 0,
        duration: 170,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  }, [onClose, panY, scrimOpacity]);

  const springBack = useCallback(() => {
    Animated.parallel([
      Animated.spring(panY, { toValue: 0, speed: 18, bounciness: 6, useNativeDriver: true }),
      Animated.timing(scrimOpacity, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start();
  }, [panY, scrimOpacity]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, g) =>
        !closingRef.current &&
        g.dy > 0 &&
        Math.abs(g.dy) > 12 &&
        Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderMove: (_e, g) => {
        dragOffsetRef.current = g.dy;
        panY.setValue(g.dy);
        scrimOpacity.setValue(Math.max(0.15, 1 - g.dy / (SCREEN_H * 0.8)));
      },
      onPanResponderRelease: (_e, g) => {
        if (dragOffsetRef.current > DISMISS_DRAG || g.vy > DISMISS_VY) {
          runDismiss();
        } else {
          dragOffsetRef.current = 0;
          springBack();
        }
      },
      onPanResponderTerminate: () => {
        dragOffsetRef.current = 0;
        springBack();
      },
    }),
  ).current;

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

  // Chrome top: safe-area inset + 16 pt so it clears the notch/cutout.
  const chromeTop = insets.top + 16;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Dark scrim — fades in/out; tapping it closes the viewer. */}
      <TouchableWithoutFeedback onPress={onClose} accessible={false}>
        <Animated.View style={[styles.scrim, { opacity: scrimOpacity }]} />
      </TouchableWithoutFeedback>

      {/* Chrome: close ✕ at start, "N / M" counter at end — below the notch. */}
      <View style={[styles.chromeRow, { top: chromeTop }]} pointerEvents="box-none">
        <Pressable
          onPress={onClose}
          style={styles.closePressable}
          accessibilityLabel="Close"
          accessibilityRole="button"
        >
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        {images.length > 1 ? (
          <Text style={styles.counter}>
            {currentIndex + 1} / {images.length}
          </Text>
        ) : null}
      </View>

      {/* Paged photos — zoom in on open, track vertical drags, contained in floating cards. */}
      <Animated.View
        style={[
          styles.pagerWrap,
          {
            transform: [{ scale: contentScale }, { translateY: panY }],
          },
        ]}
        {...panResponder.panHandlers}
      >
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
            <ViewerCardPage
              uri={item}
              insets={insets}
              colors={colors}
              onClose={onClose}
            />
          )}
          style={styles.pager}
        />
      </Animated.View>
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
  // Chrome row: close ✕ at start, "N / M" counter at end (Facebook style).
  chromeRow: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  closePressable: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  counter: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    fontVariant: ["tabular-nums"] as ("tabular-nums")[],
  },
  pagerWrap: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  imagePage: {
    width: SCREEN_W,
    height: SCREEN_H,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    borderRadius: CARD_RADIUS,
    padding: CARD_PADDING,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  cardImage: {
    borderRadius: CARD_IMAGE_RADIUS,
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
