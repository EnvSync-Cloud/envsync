export const getLatestBlog = async () => {
    try {
        const response = await fetch('https://blog.envsync.cloud/api/get-latest-blog');
        if (!response.ok) {
        throw new Error('Network response was not ok');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Failed to fetch latest blog post:', error);
        return null;
    }
}