
export type AppView = 'home' | 'subscriptions' | 'trending' | 'watch-later' | 'originals' | 'upload' | 'my-videos' | 'history';

export interface Video {
  id: string;
  title: string;
  thumbnailUrl: string;
  channelName: string;
  channelAvatarUrl: string;
  views: string;
  uploadedAt: string;
  duration: string;
  description: string;
  transcript: string;
  subscribers: string;
  likes: number;
  dislikes: number;
  isSubscribed: boolean;
  isLiked: boolean;
  isDisliked: boolean;
  isInWatchLater: boolean;
  isOriginal?: boolean;
  creatorId?: string;
  creatorName?: string;
}

export interface Comment {
  id: string;
  author: string;
  authorAvatarUrl: string;
  text: string;
  timestamp: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
}
