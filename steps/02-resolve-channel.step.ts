import {EventConfig} from 'motia'

// Step - 2 : Convert 
// Converts youtube handle/name to channel id using youtube data api
export const config : EventConfig = {
    name: "ResolveChannel",
    type: "event",
    subscribes: ['yt.submit'],
    emits: ['yt.channel.resolved',"yt.channel.error"] // Event to listen
}

export const handler = async (eventData:any,{emit,logger,state}:any) => {

    let jobId : string | undefined
    let email: string | undefined

    try {
        const data = eventData || {};

        jobId = data.jobId;
        email = data.email;
        const channel = data.channel;

        logger.info("Resolving youtube channel",{jobId,channel});

        const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

        if(!YOUTUBE_API_KEY){
            throw new Error("Missing YOUTUBE_API_KEY in environment variables")
        }

        const jobData = await state.get(`job: ${jobId}`);

        await state.set(`job: ${jobId}`,{
            ...jobData,
            status: "resolving_channel",
        })
        
        let channelId: string | null = null;
        let channelName: string | null = null;

        if(channel.startsWith("@")){
          const handle = channel.substring(1);

          const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(handle)}&key=${YOUTUBE_API_KEY}`;
          
          const searchResponse = await fetch(searchUrl);

          const searchData = await searchResponse.json();

          if(searchData.items && searchData.items.length > 0){
            channelId = searchData.items[0].snippet.channelId;
            channelName = searchData.items[0].snippet.channelTitle;

              logger.info("Channel resolved from handle",{jobId,channelId});

          } else {
              throw new Error("Channel handle not found")
          }

        }
        else{
            const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(channel)}&key=${YOUTUBE_API_KEY}`;
          
          const searchResponse = await fetch(searchUrl);

          const searchData = await searchResponse.json();

          if(searchData.items && searchData.items.length > 0){
            channelId = searchData.items[0].snippet.channelId;
            channelName = searchData.items[0].snippet.channelTitle;

              logger.info("Channel resolved from handle",{jobId,channelId});

              
          } else {
              throw new Error("Channel handle not found")
          }

        }

        if(!channelId){
            // throw new Error("Failed to resolve channel ID");
            await state.set(`job: ${jobId}`,{
                ...jobData,
                status: "failed",
                error: "Failed to resolve channel ID",
            })
            await emit({
                topic: 'yt.channel.error',
                data: {
                    jobId,
                    email,
                    error: 'Failed to resolve channel'
                }
            })
            return;
        }

        // await state.set(`job: ${jobId}`,{
        //     ...jobData,
        //     status: "channel_resolved",
        //     channelId,
        //     channelName
        // })

        await emit({
            topic: 'yt.channel.resolved',
            data: {
                jobId,
                email,
                channelId,
                channelName
            }
        })

        return;
    } catch (error:any) {
        logger.error("Error in ResolveChannel step",{error: error.message})

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
            topic: 'yt.channel.error',
            data: {
                jobId,
                email,
                error: 'Failed to resolve channel'
            }
        })
    }
}
