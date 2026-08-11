import React from 'react';
import Link from 'next/link';
import { MessageCircle, Search, Home, LayoutGrid, Settings, PanelLeftClose, PanelLeft, MoreHorizontal, Trash2, CornerUpLeft, LogOut, ChevronDown, CreditCard, HelpCircle, Plus, Link as LinkIcon, FolderOpen, GitBranch, Sparkles } from 'lucide-react';
import type { User as SupabaseUser, Session, AuthChangeEvent } from '@supabase/supabase-js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { getProjects, Project, deleteProject } from '@/lib/database';
import { formatDistanceToNow } from 'date-fns';
import { useIsMobile } from '@/hooks/use-media-query';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PricingModal } from '@/components/pricing';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  userPlan?: string;
  onStartNewChat?: () => void;
  onSearch?: (query: string) => void;
  onGetFreeTokens?: () => void;
  onSignOut?: () => void;
  onChatSelected?: (chatId: string) => void;
  onHomeClick?: () => void;
  onProjectDeleted?: (chatId: string) => void;
  searchQuery?: string;
  refreshKey?: number;
}

interface ChatHistoryItem {
  id: string;
  title: string;
  date: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen: initialIsOpen = true,
  onClose = () => {},
  userPlan = "Personal Plan",
  onStartNewChat = () => {},
  onSearch = () => {},
  onGetFreeTokens = () => {},
  onSignOut = () => {},
  onChatSelected = () => {},
  onHomeClick = () => {
    window.location.assign('/');
  },
  onProjectDeleted = () => {},
  searchQuery: externalSearchQuery = "",
  refreshKey = 0,
}) => {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isOpen, setIsOpen] = React.useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sidebar-is-open')
      return stored !== null ? stored === 'true' : initialIsOpen
    }
    return initialIsOpen
  });
  const [isPricingModalOpen, setIsPricingModalOpen] = React.useState(false);
  const [user, setUser] = React.useState<SupabaseUser | null>(null);
  const [chatHistory, setChatHistory] = React.useState<ChatHistoryItem[]>([]);
  const [credits, setCredits] = React.useState<number>(0);
  const [deleteTarget, setDeleteTarget] = React.useState<ChatHistoryItem | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = React.useState('');
  const [deleteError, setDeleteError] = React.useState('');
  const [isDeletingChat, setIsDeletingChat] = React.useState(false);
  const isMobile = useIsMobile();

  React.useEffect(() => {
    localStorage.setItem('sidebar-is-open', String(isOpen))
  }, [isOpen]);

  const activeSearchQuery = externalSearchQuery || searchQuery;

  const filteredChatHistory = React.useMemo(() => {
    if (!activeSearchQuery.trim()) {
      return chatHistory;
    }
    return chatHistory.filter(chat =>
      chat.title.toLowerCase().includes(activeSearchQuery.toLowerCase())
    );
  }, [chatHistory, activeSearchQuery]);

  const recentChats = chatHistory.slice(0, 3);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    onSearch(value);
  };

  const handleHomeClick = () => {
    onHomeClick();
    if (isMobile) {
      setIsOpen(false);
    }
  };

  const handleRequestDeleteChat = (chat: ChatHistoryItem) => {
    setDeleteTarget(chat);
    setDeleteConfirmation('');
    setDeleteError('');
  };

  const resetDeleteDialog = () => {
    if (isDeletingChat) return;
    setDeleteTarget(null);
    setDeleteConfirmation('');
    setDeleteError('');
  };

  const handleDeleteChat = async () => {
    if (!deleteTarget || deleteConfirmation.trim() !== deleteTarget.title || isDeletingChat) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setDeleteError('Supabase is not configured, so this project cannot be deleted here.');
      return;
    }

    setIsDeletingChat(true);
    setDeleteError('');

    try {
      const deleted = await deleteProject(supabase, deleteTarget.id);

      if (!deleted) {
        setDeleteError('Could not delete this project. Refresh and try again.');
        return;
      }

      setChatHistory((history) => history.filter(chat => chat.id !== deleteTarget.id));
      onProjectDeleted(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteConfirmation('');
    } catch (error) {
      console.error('Error deleting project:', error);
      setDeleteError(error instanceof Error ? error.message : 'Could not delete this project.');
    } finally {
      setIsDeletingChat(false);
    }
  };

  const canDeleteTarget =
    Boolean(deleteTarget) &&
    deleteConfirmation.trim() === deleteTarget?.title &&
    !isDeletingChat;

  React.useEffect(() => {
    if (isMobile) {
      setIsOpen(false);
    }
  }, [isMobile]);

  React.useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      return;
    }

    const fetchChatHistory = async () => {
      const projects = await getProjects(supabase);
      const history = projects.map((project: Project) => ({
        id: project.id,
        title: project.title,
        date: formatDistanceToNow(new Date(project.updated_at), { addSuffix: true }),
      }));
      setChatHistory(history);
    };

    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        fetchChatHistory();
        const { data: profile } = await supabase
          .from('profiles')
          .select('credits')
          .eq('user_id', user.id)
          .single();
        if (profile) setCredits(profile.credits ?? 0);
      }
    };
    getUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchChatHistory();
      } else {
        setChatHistory([]);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [refreshKey]);

  const workspaceName = user?.user_metadata?.name ?? 'Anonymous';
  const workspaceInitial = workspaceName.charAt(0).toUpperCase();

  return (
    <div className="flex h-dvh shrink-0 md:h-screen">
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/55 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div
        className={`
          bg-[#0a0a0b] border-r border-white/[0.06] flex flex-col relative z-10
          h-dvh md:h-screen shrink-0
          ${isMobile ? 'overflow-hidden ' : ''}
          ${isMobile
            ? `fixed inset-y-0 left-0 z-50 transition-[width,transform] duration-300 ease-in-out ${isOpen ? 'w-[min(82vw,18rem)] translate-x-0' : 'w-0 -translate-x-full'}`
            : `${isOpen ? 'w-60' : 'w-14'}`
          }
        `}
      >
        {isOpen ? (
          <div className="flex flex-col h-full">
            {/* Workspace Selector */}
            <div className="px-3 py-2 border-b border-white/[0.06]">
              <div className="flex items-center justify-between">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex-1 justify-between h-9 px-2 text-white/90 hover:bg-white/[0.08] hover:text-white"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="bg-white/10 text-white/60 text-[10px] font-medium">
                            {workspaceInitial}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate">{workspaceName}&apos;s Workspace</span>
                      </div>
                      <ChevronDown className="h-4 w-4 text-white/40 shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="start" className="w-64 bg-[#111211] border-white/10 z-[100]">
                  {/* Workspace Header */}
                  <div className="px-4 py-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-11 w-11">
                        <AvatarFallback className="bg-white/10 text-white/60 text-sm font-medium">
                          {workspaceInitial}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white">{workspaceName}&apos;s Workspace</p>
                        <p className="text-xs text-white/50">Free Plan · 1 member</p>
                      </div>
                    </div>
                    <DropdownMenuItem className="w-full mt-4 h-9 text-sm border border-white/10 bg-transparent text-white hover:bg-white/5 justify-center">
                      Invite members
                    </DropdownMenuItem>
                  </div>

                  {/* Credits */}
                  <a href="/credits" className="block px-4 py-4 border-b border-white/10 hover:bg-white/5 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white/50">Credits</span>
                      <span className="text-sm text-white/70">{credits} left</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white/40 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (credits / 500) * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-white/40 mt-2">● Click to claim daily credits</p>
                  </a>

                  {/* Workspaces List */}
                  <div className="px-4 py-3">
                    <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Workspaces</p>
                    <DropdownMenuItem className="flex items-center gap-3 px-3 py-2 rounded-md bg-white/5">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="bg-white/10 text-white/60 text-[10px]">
                          {workspaceInitial}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-white flex-1">{workspaceName}&apos;s Workspace</span>
                      <span className="text-xs text-white/40 bg-white/10 px-2 py-0.5 rounded">Free</span>
                      <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="flex items-center gap-3 px-3 py-2 text-sm text-white/50 hover:text-white/70">
                      <Plus className="h-4 w-4" />
                      <span>New workspace</span>
                    </DropdownMenuItem>
                  </div>

                  <DropdownMenuSeparator className="bg-white/10" />

                  {/* Menu Items */}
                  <div className="py-2">
                    <DropdownMenuItem onClick={() => setIsPricingModalOpen(true)} className="text-white/70 focus:bg-white/5 focus:text-white px-4 py-2.5">
                      <Settings className="mr-3 h-4 w-4" />
                      <span>Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-white/70 focus:bg-white/5 focus:text-white px-4 py-2.5">
                      <HelpCircle className="mr-3 h-4 w-4" />
                      <span>Help Center</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsPricingModalOpen(true)} className="text-white/70 focus:bg-white/5 focus:text-white px-4 py-2.5">
                      <CreditCard className="mr-3 h-4 w-4" />
                      <span>My Subscription</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/10 my-1" />
                    <DropdownMenuItem onClick={onSignOut} className="text-white/70 focus:bg-white/5 focus:text-white px-4 py-2.5">
                      <LogOut className="mr-3 h-4 w-4" />
                      <span>Sign Out</span>
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-9 w-9 text-white/50 hover:text-white hover:bg-white/10 shrink-0"
                aria-label="Close sidebar"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
              </div>
            </div>

            {/* Navigation */}
            <div className="px-2 py-1 space-y-0.5">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-9 text-white/70 hover:bg-white/[0.08] hover:text-white"
                onClick={handleHomeClick}
              >
                <Home className="h-4 w-4 shrink-0" />
                <span className="text-sm">Dashboard</span>
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-9 text-white/70 hover:bg-white/[0.08] hover:text-white"
                onClick={() => {
                  setTimeout(() => {
                    const searchInput = document.querySelector('input[placeholder="Search"]') as HTMLInputElement
                    searchInput?.focus()
                  }, 100)
                }}
              >
                <Search className="h-4 w-4 shrink-0" />
                <span className="text-sm flex-1 text-left">Search</span>
                <kbd className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded font-mono">Ctrl K</kbd>
              </Button>
              <Link href="/templates" className="block">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 h-9 text-white/70 hover:bg-white/[0.08] hover:text-white"
                >
                  <LayoutGrid className="h-4 w-4 shrink-0" />
                  <span className="text-sm">Templates</span>
                </Button>
              </Link>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-9 text-white/70 hover:bg-white/[0.08] hover:text-white"
                onClick={onStartNewChat}
              >
                <LinkIcon className="h-4 w-4 shrink-0" />
                <span className="text-sm">Connectors</span>
              </Button>
              <Link href="/import/github" className="block">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 h-9 text-white/70 hover:bg-white/[0.08] hover:text-white"
                >
                  <GitBranch className="h-4 w-4 shrink-0" />
                  <span className="text-sm">GitHub Import</span>
                </Button>
              </Link>
            </div>

            {/* Projects Section */}
            <div className="px-2 py-2">
              <h3 className="px-3 text-xs font-medium text-white/40 uppercase tracking-wider mb-1">Projects</h3>
              <div className="space-y-0.5">
                <Link href="/projects" className="block">
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-8 text-white/60 hover:bg-white/[0.08] hover:text-white"
                  >
                    <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-sm">All projects</span>
                  </Button>
                </Link>
              </div>
            </div>

            {/* Recents Section */}
            <div className="flex-1 overflow-y-auto px-2 py-2">
              <h3 className="px-3 text-xs font-medium text-white/40 uppercase tracking-wider mb-1">Recents</h3>
              {recentChats.length === 0 ? (
                <p className="px-3 text-xs text-white/30">No recent projects</p>
              ) : (
                <div className="space-y-0.5">
                  {recentChats.map((chat) => (
                    <div key={chat.id} className="group flex items-center">
                      <Button
                        variant="ghost"
                        onClick={() => onChatSelected(chat.id)}
                        className="min-w-0 flex-1 justify-start gap-3 h-8 text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors"
                      >
                        <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate text-sm">{chat.title}</span>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-white/30 opacity-0 transition-opacity hover:bg-white/[0.08] hover:text-white group-hover:opacity-100"
                            aria-label={`More actions for ${chat.title}`}
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="right" align="start">
                          <DropdownMenuItem onClick={() => onChatSelected(chat.id)}>
                            <CornerUpLeft className="mr-2 h-4 w-4" />
                            <span>Re-enter</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRequestDeleteChat(chat)} className="text-red-500">
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* User Info */}
            <div className="px-3 py-3 border-t border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.user_metadata?.name ?? 'User'} />
                  <AvatarFallback className="bg-white/10 text-white/60 text-xs">
                    {workspaceInitial}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">
                    {workspaceName}
                  </p>
                  <p className="text-[10px] text-white/40 truncate">
                    {userPlan}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Compact icon rail */
          !isMobile && (
            <div className="flex flex-col items-center py-3 h-full">
              <div className="flex flex-col items-center space-y-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(true)}
                  className="h-9 w-9 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Open sidebar"
                >
                  <PanelLeft className="h-4 w-4" />
                </Button>

                <Link href="/" className="shrink-0">
                  <div className="h-6 w-6 flex items-center justify-center rounded-md bg-gradient-to-br from-purple-500 to-blue-500">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                  </div>
                </Link>

                <div className="w-6 h-px bg-white/10 my-1" />

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleHomeClick}
                  className="h-9 w-9 text-white/50 hover:text-white hover:bg-white/[0.08]"
                  aria-label="Dashboard"
                >
                  <Home className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setIsOpen(true)
                    setTimeout(() => {
                      const searchInput = document.querySelector('input[placeholder="Search"]') as HTMLInputElement
                      searchInput?.focus()
                    }, 100)
                  }}
                  className="h-9 w-9 text-white/50 hover:text-white hover:bg-white/[0.08]"
                  aria-label="Search"
                >
                  <Search className="h-4 w-4" />
                </Button>

                <Link href="/templates">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-white/50 hover:text-white hover:bg-white/[0.08]"
                    aria-label="Templates"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </Link>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onStartNewChat}
                  className="h-9 w-9 text-white/50 hover:text-white hover:bg-white/[0.08]"
                  aria-label="Connectors"
                >
                  <LinkIcon className="h-4 w-4" />
                </Button>

                <Link href="/import/github">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-white/50 hover:text-white hover:bg-white/[0.08]"
                    aria-label="GitHub Import"
                  >
                    <GitBranch className="h-4 w-4" />
                  </Button>
                </Link>

                <div className="flex-1" />

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onGetFreeTokens}
                  className="h-9 w-9 text-green-500 hover:text-green-400 hover:bg-green-500/10"
                  aria-label="Get free tokens"
                >
                </Button>
              </div>
            </div>
          )
        )}
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => {
        if (!open) resetDeleteDialog();
      }}>
        <AlertDialogContent className="border-white/10 bg-[#111211] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              This will remove the project from your workspace. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteTarget && (
            <div className="space-y-3">
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-red-200/80">
                  Project name
                </div>
                <div className="mt-1 break-words text-sm font-semibold text-white">
                  {deleteTarget.title}
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="project-delete-confirmation" className="text-sm text-white/70">
                  Type the project name to confirm deletion.
                </label>
                <Input
                  id="project-delete-confirmation"
                  value={deleteConfirmation}
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                  disabled={isDeletingChat}
                  autoComplete="off"
                  className="border-white/10 bg-white/[0.04] text-white placeholder:text-white/35"
                />
              </div>
              {deleteError && (
                <div className="rounded-md border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {deleteError}
                </div>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isDeletingChat}
              className="border-white/10 bg-transparent text-white hover:bg-white/10"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={!canDeleteTarget}
              onClick={handleDeleteChat}
              className="bg-red-600 text-white hover:bg-red-500 disabled:opacity-45"
            >
              {isDeletingChat ? 'Deleting...' : 'Delete project'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <PricingModal isOpen={isPricingModalOpen} onClose={() => setIsPricingModalOpen(false)} />
    </div>
  );
};
