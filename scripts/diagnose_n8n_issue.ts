import Database from 'better-sqlite3';

const db = new Database('./data/sunday.db', { readonly: true });

try {
    console.log('--- Diagnosis: Emotional Intelligence Post ---');

    // 1. Find the post
    const posts = db.prepare(`
    SELECT id, user_id, content, image_url, status, scheduled_at, published_at, error_message 
    FROM posts 
    WHERE content LIKE '%emotional intelligence%'
  `).all();

    if (posts.length === 0) {
        console.log('No post found with "emotional intelligence".');
    } else {
        for (const post of posts) {
            console.log(`\nPost ID: ${post.id}`);
            console.log(`User ID: ${post.user_id}`);
            console.log(`Status: ${post.status}`);
            console.log(`Image URL: ${post.image_url}`);
            console.log(`Content Preview: ${post.content.substring(0, 50)}...`);
            console.log(`Error Message: ${post.error_message}`);

            // 2. Get User
            const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(post.user_id);
            console.log(`User: ${user.name} (${user.email})`);

            // 3. Get Settings
            const settings = db.prepare('SELECT linkedin_connected, linkedin_person_urn, linkedin_profile_url, linkedin_access_token, linkedin_refresh_token FROM user_settings WHERE user_id = ?').get(post.user_id);
            if (settings) {
                console.log(`LinkedIn Connected: ${settings.linkedin_connected}`);
                console.log(`LinkedIn Person URN: ${settings.linkedin_person_urn}`);
                console.log(`LinkedIn Access Token: ${settings.linkedin_access_token ? settings.linkedin_access_token.substring(0, 15) + '...' : 'None'}`);
                console.log(`LinkedIn Profile: ${settings.linkedin_profile_url}`);
            } else {
                console.log('No User Settings found.');
            }

            // 4. Get Accounts (Auth.js)
            const accounts = db.prepare('SELECT provider, access_token, refresh_token FROM accounts WHERE userId = ? AND provider = ?').all(post.user_id, 'linkedin');
            if (accounts.length > 0) {
                for (const acc of accounts) {
                    // @ts-ignore
                    console.log(`Account Provider: ${acc.provider}`);
                    // @ts-ignore
                    console.log(`Account Access Token: ${acc.access_token ? acc.access_token.substring(0, 15) + '...' : 'None'}`);
                }
            } else {
                console.log('No LinkedIn Account found in accounts table.');
            }
        }
    }

    console.log('\n--- End of Diagnosis ---');

} catch (err) {
    console.error('Error running diagnosis:', err);
} finally {
    db.close();
}
