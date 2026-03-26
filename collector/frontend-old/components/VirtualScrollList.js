/**
 * Virtual Scroll List Component
 * Efficiently renders large lists by only rendering visible items
 */

import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect, useRef, useMemo } from 'https://esm.sh/preact/hooks';
import { debounce } from '../utils/performance.js';

const VirtualScrollList = ({
    items = [],
    itemHeight = 50,
    containerHeight = 400,
    renderItem,
    overscan = 5,
    className = '',
    onScroll = null,
    estimatedItemHeight = null,
    variableHeight = false,
    ...props
}) => {
    const [scrollTop, setScrollTop] = useState(0);
    const [containerSize, setContainerSize] = useState({ width: 0, height: containerHeight });
    const containerRef = useRef(null);
    const scrollElementRef = useRef(null);
    const itemHeights = useRef(new Map());
    const itemPositions = useRef(new Map());

    // Calculate item positions for variable height items
    const calculateItemPositions = useMemo(() => {
        if (!variableHeight) return null;

        let totalHeight = 0;
        const positions = new Map();

        items.forEach((item, index) => {
            positions.set(index, totalHeight);
            const height = itemHeights.current.get(index) || estimatedItemHeight || itemHeight;
            totalHeight += height;
        });

        itemPositions.current = positions;
        return totalHeight;
    }, [items, variableHeight, estimatedItemHeight, itemHeight]);

    // Calculate visible range
    const visibleRange = useMemo(() => {
        if (!items.length) return { start: 0, end: 0 };

        let start, end;

        if (variableHeight && itemPositions.current.size > 0) {
            // Binary search for start index
            start = 0;
            let left = 0, right = items.length - 1;
            
            while (left <= right) {
                const mid = Math.floor((left + right) / 2);
                const position = itemPositions.current.get(mid) || 0;
                
                if (position < scrollTop) {
                    start = mid;
                    left = mid + 1;
                } else {
                    right = mid - 1;
                }
            }

            // Find end index
            end = start;
            let currentPosition = itemPositions.current.get(start) || 0;
            
            while (end < items.length && currentPosition < scrollTop + containerSize.height) {
                const height = itemHeights.current.get(end) || estimatedItemHeight || itemHeight;
                currentPosition += height;
                end++;
            }
        } else {
            // Fixed height calculation
            start = Math.floor(scrollTop / itemHeight);
            end = Math.min(
                items.length,
                Math.ceil((scrollTop + containerSize.height) / itemHeight)
            );
        }

        // Apply overscan
        start = Math.max(0, start - overscan);
        end = Math.min(items.length, end + overscan);

        return { start, end };
    }, [scrollTop, containerSize.height, items.length, itemHeight, overscan, variableHeight, estimatedItemHeight]);

    // Calculate total height
    const totalHeight = useMemo(() => {
        if (variableHeight && calculateItemPositions !== null) {
            return calculateItemPositions;
        }
        return items.length * itemHeight;
    }, [items.length, itemHeight, variableHeight, calculateItemPositions]);

    // Handle scroll events
    const handleScroll = useMemo(() => 
        debounce((event) => {
            const newScrollTop = event.target.scrollTop;
            setScrollTop(newScrollTop);
            
            if (onScroll) {
                onScroll(event, {
                    scrollTop: newScrollTop,
                    scrollHeight: event.target.scrollHeight,
                    clientHeight: event.target.clientHeight
                });
            }
        }, 16), // ~60fps
        [onScroll]
    );

    // Handle resize
    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setContainerSize({
                    width: rect.width,
                    height: rect.height
                });
            }
        };

        const resizeObserver = new ResizeObserver(handleResize);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
            handleResize(); // Initial size
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    // Measure item heights for variable height mode
    const measureItemHeight = (index, element) => {
        if (!variableHeight || !element) return;

        const height = element.getBoundingClientRect().height;
        if (height > 0 && itemHeights.current.get(index) !== height) {
            itemHeights.current.set(index, height);
            // Trigger recalculation
            setScrollTop(prev => prev);
        }
    };

    // Get item style for positioning
    const getItemStyle = (index) => {
        if (variableHeight && itemPositions.current.has(index)) {
            const top = itemPositions.current.get(index);
            return {
                position: 'absolute',
                top: `${top}px`,
                left: 0,
                right: 0,
                minHeight: `${estimatedItemHeight || itemHeight}px`
            };
        }

        return {
            position: 'absolute',
            top: `${index * itemHeight}px`,
            left: 0,
            right: 0,
            height: `${itemHeight}px`
        };
    };

    // Render visible items
    const visibleItems = [];
    for (let i = visibleRange.start; i < visibleRange.end; i++) {
        const item = items[i];
        if (!item) continue;

        const itemElement = renderItem(item, i, {
            style: getItemStyle(i),
            ref: variableHeight ? (el) => measureItemHeight(i, el) : null,
            key: i
        });

        visibleItems.push(itemElement);
    }

    return html`
        <div 
            ref=${containerRef}
            class="virtual-scroll-container ${className}"
            style=${{
                height: `${containerHeight}px`,
                overflow: 'hidden',
                position: 'relative'
            }}
            ...${props}
        >
            <div
                ref=${scrollElementRef}
                class="virtual-scroll-viewport"
                style=${{
                    height: '100%',
                    overflow: 'auto',
                    position: 'relative'
                }}
                onScroll=${handleScroll}
            >
                <div
                    class="virtual-scroll-content"
                    style=${{
                        height: `${totalHeight}px`,
                        position: 'relative'
                    }}
                >
                    ${visibleItems}
                </div>
            </div>
            
            ${items.length === 0 && html`
                <div class="virtual-scroll-empty">
                    <p>No items to display</p>
                </div>
            `}
        </div>
    `;
};

// Virtual Grid Component for 2D virtualization
export const VirtualGrid = ({
    items = [],
    itemWidth = 200,
    itemHeight = 150,
    containerWidth = 800,
    containerHeight = 400,
    renderItem,
    columns = null,
    gap = 10,
    className = '',
    ...props
}) => {
    const [scrollTop, setScrollTop] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    const containerRef = useRef(null);

    // Calculate columns if not provided
    const actualColumns = columns || Math.floor((containerWidth + gap) / (itemWidth + gap));
    const rows = Math.ceil(items.length / actualColumns);

    // Calculate visible range
    const visibleRange = useMemo(() => {
        const startRow = Math.floor(scrollTop / (itemHeight + gap));
        const endRow = Math.min(rows, Math.ceil((scrollTop + containerHeight) / (itemHeight + gap)) + 1);
        
        const startCol = Math.floor(scrollLeft / (itemWidth + gap));
        const endCol = Math.min(actualColumns, Math.ceil((scrollLeft + containerWidth) / (itemWidth + gap)) + 1);

        return { startRow, endRow, startCol, endCol };
    }, [scrollTop, scrollLeft, containerHeight, containerWidth, itemHeight, itemWidth, gap, rows, actualColumns]);

    // Handle scroll
    const handleScroll = useMemo(() => 
        debounce((event) => {
            setScrollTop(event.target.scrollTop);
            setScrollLeft(event.target.scrollLeft);
        }, 16),
        []
    );

    // Render visible items
    const visibleItems = [];
    for (let row = visibleRange.startRow; row < visibleRange.endRow; row++) {
        for (let col = visibleRange.startCol; col < visibleRange.endCol; col++) {
            const index = row * actualColumns + col;
            if (index >= items.length) break;

            const item = items[index];
            const x = col * (itemWidth + gap);
            const y = row * (itemHeight + gap);

            const itemElement = renderItem(item, index, {
                style: {
                    position: 'absolute',
                    left: `${x}px`,
                    top: `${y}px`,
                    width: `${itemWidth}px`,
                    height: `${itemHeight}px`
                },
                key: index
            });

            visibleItems.push(itemElement);
        }
    }

    const totalWidth = actualColumns * (itemWidth + gap) - gap;
    const totalHeight = rows * (itemHeight + gap) - gap;

    return html`
        <div 
            ref=${containerRef}
            class="virtual-grid-container ${className}"
            style=${{
                width: `${containerWidth}px`,
                height: `${containerHeight}px`,
                overflow: 'auto',
                position: 'relative'
            }}
            onScroll=${handleScroll}
            ...${props}
        >
            <div
                class="virtual-grid-content"
                style=${{
                    width: `${totalWidth}px`,
                    height: `${totalHeight}px`,
                    position: 'relative'
                }}
            >
                ${visibleItems}
            </div>
        </div>
    `;
};

export default VirtualScrollList;