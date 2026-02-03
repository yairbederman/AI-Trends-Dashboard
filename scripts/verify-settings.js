
// Native fetch in Node 18+

async function verifyPersistence() {
    const baseUrl = 'http://localhost:3000';
    try {
        console.log('1. Setting TimeRange to 7d...');
        const updateRes = await fetch(`${baseUrl}/api/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'UPDATE_TIME_RANGE',
                payload: { timeRange: '7d' }
            }),
        });

        if (!updateRes.ok) {
            console.error('Update failed:', await updateRes.text());
            return;
        }
        console.log('Update success.');

        console.log('2. Fetching settings...');
        const getRes = await fetch(`${baseUrl}/api/settings`);
        if (!getRes.ok) {
            console.error('Fetch failed:', await getRes.text());
            return;
        }
        const data = await getRes.json();
        console.log('Fetched settings:', data);

        if (data.timeRange === '7d') {
            console.log('SUCCESS: TimeRange persisted correctly.');
        } else {
            console.error('FAILURE: TimeRange expected 7d, got', data.timeRange);
        }

    } catch (e) {
        console.error('Test failed:', e);
    }
}

verifyPersistence();
