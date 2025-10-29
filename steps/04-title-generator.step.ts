import {EventConfig} from 'motia'

// Step - 4 : AI title  
// Uses OpenAI GPT-4 to generate video titles 
export const config : EventConfig = {
    name: "generateTitles",
    type: "event",
    subscribes: ['yt.videos.fetched'],
    emits: ['yt.titles.ready',"yt.titles.error"] // Event to listen
}

interface Video  {
    videoId: string,
    title: string,
    url: string,
    publishedAt: string,
    thumbnail: string
}

interface ImprovedTitle {
    originalTitle: string,
    improvedTitle: string,
    rational: string,
    url: string
}

export const handler = async (eventData:any,{emit,logger,state}:any) => {

    let jobId : string | undefined
    let email: string | undefined

    try {
        const data = eventData || {};

        jobId = data.jobId;
        email = data.email;

        const channelName = data.channelName;
        const videos = data.videos as Video[];

        logger.info("Starting title generation step",{jobId,channelName,videosLength: videos.length})

        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

        if(!OPENAI_API_KEY){
            throw new Error("Missing OPENAI_API_KEY in environment variables")
        }

        const jobData = await state.get(`job: ${jobId}`);

        await state.set(`job: ${jobId}`,{
            ...jobData,
            status: "generating_titles",
        });

        const videoTitles = videos.map((v,idx) => `${idx + 1}. ${v.title}`).join('\n');

        const prompt = `You are an expert YouTube content creator.`

        const response = await fetch('https://api.openai.com/v1/chat/completions',{
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: prompt
                    },
                    {
                        role: 'user',
                        content: `Generate improved and catchy titles for the following YouTube videos from the channel ${channelName}`
                    }
                ],
                temperature: 0.7,
                response_format: {type: 'json_object'}
            })
        })

        if(!response.ok){
            const errorText = await response.json();

            throw new Error(`OpenAI API error: ${errorText.error.message}`);
        }

        const aiResponse = await response.json();

        const aiContent = aiResponse.choices[0].message;

        const parsedResponse = JSON.parse(aiContent);

        const improvedTitles: ImprovedTitle[] = parsedResponse.improvedTitles.map((item: any, index: number) => ({
            originalTitle: videos[index].title,
            improvedTitle: item.improvedTitle,
            rational: item.rational,
            url: videos[index].url
        }));

        logger.info("Generated improved titles",{jobId,improvedTitlesCount: improvedTitles.length})

        await state.set(`job: ${jobId}`,{
            ...jobData,
            status: "titles_generated",
            improvedTitles,
        });

        await emit({
            topic: 'yt.titles.ready',
            data: {
                jobId,
                email,
                channelName,
                improvedTitles
            }
        })
    } catch (error: any) {
        logger.error("Error in title generate step",{error: error.message})

        if(!jobId || !email){
            logger.warn("Missing jobId or email in event data", {eventData})
            return
        }

        const jobData = await state.get(`job:${jobId}`);

        await state.set(`job: ${jobId}`,{
            ...jobData,
            status: "failed",
            error: error.message,
        })

        await emit({
            topic: 'yt.titles.error',
            data: {
                jobId,
                email,
                error: 'Failed to fetch improved titles'
            }
        })
        
    }
}