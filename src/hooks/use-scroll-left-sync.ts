import { useRef } from "react";

/**
 * Keeps one box scrolled sideways as far as another, such as a header outside the box it labels. Call `onScroll` from the leader.
 * Both boxes get `data-scrolled` while scrolled away from the left edge, for styles that only apply then.
 */
export function useScrollLeftSync<Leader extends HTMLElement, Follower extends HTMLElement>() {
  const leaderRef = useRef<Leader>(null);
  const followerRef = useRef<Follower>(null);
  const onScroll = () => {
    const leader = leaderRef.current;
    const follower = followerRef.current;
    if (!leader || !follower) return;
    follower.scrollLeft = leader.scrollLeft;
    const scrolled = leader.scrollLeft > 0;
    leader.toggleAttribute("data-scrolled", scrolled);
    follower.toggleAttribute("data-scrolled", scrolled);
  };
  return { leaderRef, followerRef, onScroll };
}
