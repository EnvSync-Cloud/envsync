export const discordWebhook = (
    url: string,
    payload: {
        event_type: string;
        org_name: string;
        app_name?: string;
        user_name: string;
        data: Record<string, any>;
        webhook_name: string;
        linked_to_entity: string;
        timestamp: string;
        url_for_entity_in_question: string;
    }
) => {
    const templateText = {
        content: "",
        tts: false,
        embeds: [
            {
                id: 652627557,
                title: "",
                description: `New Activity via *${payload.webhook_name}* on *EnvSync*`,
                color: 2326507,
                fields: [
                    {
                        id: 928721936,
                        name: "Action Type",
                        value: payload.event_type
                    },
                    {
                        id: 938685491,
                        name: "Based to",
                        value: payload.linked_to_entity
                    },
                    {
                        id: 164081742,
                        name: "Acted by",
                        value: payload.user_name
                    },
                    {
                        id: 923005368,
                        name: "When",
                        value: payload.timestamp
                    },
                    {
                        id: 177934825,
                        name: "Message",
                        value: "```" + JSON.stringify(payload.data) + "```"
                    }
                ],
                footer: {
                    icon_url: "https://github.com/EnvSync-Cloud.png"
                },
                timestamp: payload.timestamp,
                author: {
                    icon_url: "https://github.com/EnvSync-Cloud.png",
                    name: "EnvSync",
                    url: payload.url_for_entity_in_question
                }
            }
        ],
        components: [],
        actions: {},
        flags: 0,
        username: "EnvSync",
        avatar_url: "https://github.com/EnvSync-Cloud.png"
    };

    return fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(templateText)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Discord webhook failed with status ${response.status}`);
        }
        return response.json();
    })
    .catch(error => {
        console.error("Error triggering Discord webhook:", error);
        throw error;
    });
}