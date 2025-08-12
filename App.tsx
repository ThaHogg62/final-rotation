
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import VideoGrid from './components/VideoGrid';
import WatchPage from './components/WatchPage';
import UploadPage from './components/UploadPage';
import { VideoGridSkeleton } from './components/skeletons';
import ErrorDisplay from './components/ErrorDisplay';
import AuthModal from './components/AuthModal';
import EditVideoModal from './components/EditVideoModal';
import ConfirmationModal from './components/ConfirmationModal';
import { Video, User, AppView } from './types';
import * as api from './services/api';

const App: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Navigation State
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [didCheckUrl, setDidCheckUrl] = useState(false);

  // Creator modal states
  const [editVideo, setEditVideo] = useState<Video | null>(null);
  const [deleteVideo, setDeleteVideo] = useState<Video | null>(null);

  const fetchData = useCallback(async (view: AppView, user: User | null) => {
    if (view === 'upload') {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      let fetchedVideos: Video[] = [];
      if (view === 'home' || view === 'subscriptions') {
        fetchedVideos = await api.getVideos(user);
      } else if (view === 'trending') {
        fetchedVideos = await api.getTrendingVideos(user);
      } else if (view === 'watch-later') {
        fetchedVideos = await api.getWatchLaterVideos(user);
      } else if (view === 'originals') {
        fetchedVideos = await api.getOriginalsVideos(user);
      } else if (view === 'my-videos') {
        fetchedVideos = await api.getMyVideos(user);
      } else if (view === 'history') {
        fetchedVideos = await api.getHistoryVideos(user);
      }
      setVideos(fetchedVideos);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSelectVideo = useCallback((video: Video) => {
    setSelectedVideo(video);
    // Don't change view here to allow watching from any page
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    fetchData(currentView, currentUser);
  }, [currentView, currentUser, fetchData]);

  useEffect(() => {
    if (!isLoading && videos.length > 0 && !didCheckUrl) {
      const urlParams = new URLSearchParams(window.location.search);
      const videoId = urlParams.get('videoId');
      if (videoId) {
        const videoFromUrl = videos.find(v => v.id === videoId);
        if (videoFromUrl) {
          handleSelectVideo(videoFromUrl);
        }
        // Clean the URL after deep linking
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      setDidCheckUrl(true);
    }
  }, [isLoading, videos, didCheckUrl, handleSelectVideo]);
  
  const handleLogin = useCallback(async (email: string, password: string): Promise<User> => {
    const user = await api.login(email, password);
    setCurrentUser(user);
    setIsAuthModalOpen(false);
    return user;
  }, []);
  
  const handleRegister = useCallback(async (name: string, email: string, password: string): Promise<User> => {
    const user = await api.register(name, email, password);
    setCurrentUser(user);
    setIsAuthModalOpen(false);
    return user;
  }, []);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    setCurrentView('home');
  }, []);

  const toggleSidebar = useCallback(() => setSidebarOpen(prev => !prev), []);
  
  const handleNavigate = useCallback((view: AppView) => {
    setCurrentView(view);
    setSelectedVideo(null);
    setSearchQuery('');
  }, []);

  const handleGoHome = useCallback(() => handleNavigate('home'), [handleNavigate]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setSelectedVideo(null); 
  }, []);

  const handleUpload = useCallback(async (title: string, description: string, thumbnailUrl: string): Promise<Video> => {
    if (!currentUser) throw new Error("You must be logged in to upload a video.");
    const newVideo = await api.uploadVideo(title, description, thumbnailUrl, currentUser);
    setVideos(prev => [newVideo, ...prev]);
    handleSelectVideo(newVideo);
    return newVideo;
  }, [currentUser, handleSelectVideo]);

  const updateVideoInList = useCallback((updatedVideo: Video) => {
    setVideos(currentVideos => 
      currentVideos.map(v => v.id === updatedVideo.id ? updatedVideo : v)
    );
    if (selectedVideo?.id === updatedVideo.id) {
        setSelectedVideo(updatedVideo);
    }
  }, [selectedVideo]);
  
  const handleUpdateVideo = useCallback(async (videoId: string, title: string, description: string) => {
    if (!currentUser) return;
    const updatedVideo = await api.updateVideo(videoId, { title, description }, currentUser);
    updateVideoInList(updatedVideo);
    setEditVideo(null);
  }, [currentUser, updateVideoInList]);

  const handleDeleteVideo = useCallback(async (video: Video) => {
    if (!currentUser) return;
    await api.deleteVideo(video.id, currentUser);
    setVideos(prev => prev.filter(v => v.id !== video.id));
    setDeleteVideo(null);
  }, [currentUser]);

  const handleToggleWatchLater = useCallback(async (video: Video) => {
    if (!currentUser) return;
    const optimisticUpdate = {...video, isInWatchLater: !video.isInWatchLater };
    updateVideoInList(optimisticUpdate);
    try {
        const updatedVideo = await api.toggleWatchLater(video.id, currentUser);
        updateVideoInList(updatedVideo);
    } catch (error) {
        console.error('Failed to toggle watch later status', error);
        updateVideoInList(video);
    }
  }, [currentUser, updateVideoInList]);

  const handleSubscriptionChange = useCallback((channelName: string, newStatus: boolean) => {
    setVideos(currentVideos => 
      currentVideos.map(v => 
        v.channelName === channelName ? { ...v, isSubscribed: newStatus } : v
      )
    );
     if (selectedVideo?.channelName === channelName) {
        setSelectedVideo(prev => prev ? {...prev, isSubscribed: newStatus} : null);
    }
  }, [selectedVideo]);

  const videosToDisplay = useMemo(() => {
    let baseVideos = videos;
    if (currentView === 'subscriptions') {
      baseVideos = currentUser ? videos.filter(v => v.isSubscribed) : [];
    }
    
    if (!searchQuery) {
      return baseVideos;
    }
    
    return baseVideos.filter(video =>
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.channelName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, videos, currentView, currentUser]);

  const renderContent = () => {
    if (currentView === 'upload') {
        return <UploadPage onUpload={handleUpload} />;
    }
    if (selectedVideo) {
      const currentVideoState = videos.find(v => v.id === selectedVideo.id) || selectedVideo;
      return (
        <WatchPage 
          key={currentVideoState.id}
          video={currentVideoState} 
          allVideos={videos}
          onSelectVideo={handleSelectVideo}
          currentUser={currentUser}
          onUpdateVideo={updateVideoInList}
          onSubscriptionChange={handleSubscriptionChange}
          onToggleWatchLater={handleToggleWatchLater}
        />
      );
    }
    if (isLoading) return <VideoGridSkeleton />;
    if (error) return <ErrorDisplay message={error} />;
    
    let gridTitle = "Recommended";
    if (searchQuery) {
      gridTitle = `Results for "${searchQuery}"`;
    } else if (currentView === 'subscriptions') {
      gridTitle = "Your Subscriptions";
    } else if (currentView === 'trending') {
      gridTitle = "Trending Videos";
    } else if (currentView === 'watch-later') {
      gridTitle = "Watch Later";
    } else if (currentView === 'originals') {
      gridTitle = "In Rotation Originals";
    } else if (currentView === 'my-videos') {
      gridTitle = "My Videos";
    } else if (currentView === 'history') {
      gridTitle = "Watch History";
    }

    return (
      <VideoGrid 
        videos={videosToDisplay} 
        onSelectVideo={handleSelectVideo}
        onToggleWatchLater={handleToggleWatchLater}
        title={gridTitle}
        view={currentView}
        currentUser={currentUser}
        onEditVideo={setEditVideo}
        onDeleteVideo={setDeleteVideo}
       />
    );
  };

  return (
    <>
      <div className="min-h-screen bg-slate-900 flex flex-col">
        <Header 
          onMenuClick={toggleSidebar} 
          onLogoClick={handleGoHome} 
          onSearch={handleSearch}
          searchQuery={searchQuery}
          currentUser={currentUser}
          onLoginClick={() => setIsAuthModalOpen(true)}
          onLogout={handleLogout}
          onUploadClick={() => handleNavigate('upload')}
        />
        <div className="flex flex-1">
          <Sidebar 
            isOpen={sidebarOpen} 
            currentView={currentView}
            onNavigate={handleNavigate}
            currentUser={currentUser}
          />
          <main className={`flex-1 transition-all duration-300 ease-in-out ${sidebarOpen ? 'ml-64' : 'ml-0 md:ml-20'}`}>
            <div className="p-4 md:p-8">
              {renderContent()}
            </div>
          </main>
        </div>
      </div>
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLogin={handleLogin}
        onRegister={handleRegister}
      />
      {editVideo && (
        <EditVideoModal
          video={editVideo}
          onClose={() => setEditVideo(null)}
          onSave={handleUpdateVideo}
        />
      )}
      {deleteVideo && (
        <ConfirmationModal
          isOpen={!!deleteVideo}
          title={`Delete "${deleteVideo.title}"?`}
          description="This action is permanent and cannot be undone."
          confirmText="Delete"
          onClose={() => setDeleteVideo(null)}
          onConfirm={() => handleDeleteVideo(deleteVideo)}
        />
      )}
    </>
  );
};

export default App;
