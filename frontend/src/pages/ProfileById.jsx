import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import UserAvatar from '../components/User/UserAvatar';

const ProfileSkeleton = () => (
  <div className="container" style={{ maxWidth: 760, paddingTop: 24 }}>
    <div className="card animate-pulse" style={{ minHeight: 240 }}>
      <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--color-bg-secondary)' }} />
      <div style={{ height: 28, width: 220, background: 'var(--color-bg-secondary)', borderRadius: 8, marginTop: 18 }} />
      <div style={{ height: 16, width: '70%', background: 'var(--color-bg-secondary)', borderRadius: 8, marginTop: 12 }} />
    </div>
  </div>
);

const ProfileById = () => {
  const { userId } = useParams();
  const { token } = useAuth();

  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId && token),
    queryFn: async () => {
      const res = await fetch(`${API_URL}/users/id/${encodeURIComponent(userId)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || 'Could not load this profile.');
      return data.data?.user || data.user;
    },
    staleTime: 60_000
  });

  if (profileQuery.isLoading) return <ProfileSkeleton />;

  if (profileQuery.isError) {
    return (
      <div className="container" style={{ maxWidth: 760, paddingTop: 24 }}>
        <div className="card text-center">
          <h1 className="text-xl font-bold mb-sm">Profile unavailable</h1>
          <p className="text-muted">{profileQuery.error?.message || 'Please try again later.'}</p>
          <button type="button" className="btn btn-primary mt-lg" onClick={() => profileQuery.refetch()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const profile = profileQuery.data;

  return (
    <div className="container" style={{ maxWidth: 760, paddingTop: 24, paddingBottom: 96 }}>
      <section className="card" style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        <UserAvatar user={profile} size={96} />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold" style={{ margin: 0 }}>
            {profile.displayName || profile.username}
          </h1>
          <p className="text-muted" style={{ marginTop: 4 }}>@{profile.username}</p>
          {profile.bio && <p style={{ marginTop: 12 }}>{profile.bio}</p>}
          <div className="flex gap-sm mt-lg">
            <Link className="btn btn-primary" to={`/messages/${profile._id || profile.id}`}>
              Message
            </Link>
            {profile.username && (
              <Link className="btn btn-secondary" to={`/u/${profile.username}`}>
                Full profile
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ProfileById;
