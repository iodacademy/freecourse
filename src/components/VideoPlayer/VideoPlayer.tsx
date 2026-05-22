"use client";

import styles from "./VideoPlayer.module.css";

interface VideoPlayerProps {
  youtubeId: string;
  title?: string;
}

export default function VideoPlayer({ youtubeId, title }: VideoPlayerProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <iframe
          className={styles.iframe}
          src={`https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1`}
          title={title || "Video Pembelajaran"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}
