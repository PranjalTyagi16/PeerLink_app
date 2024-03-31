"use server"

import { revalidatePath } from "next/cache";
import User from "../models/user.model";
import { connectToDB } from "../mongoose"
import Thread from "../models/thread.model";
import { FilterQuery, SortOrder } from "mongoose";
interface Params{
    userId:string;
    username:string;
    name:string;
    bio:string;
    image:string;
    path:string;
}
//Promise<void> means it will not return any value just it is running
//for just sake of running for some side-effect like a timer delay
export async function updateUser({
    userId,
    username,
    name,
    bio,
    image,
    path,
}:Params):Promise<void> {
    connectToDB();
   try{
    await User.findOneAndUpdate(
        {id:userId},
        {
            username:username.toLowerCase(),
            name,
            bio,
            image,
            onboarded:true,
        
        
        },
        {upsert:true}
        
        );
        if(path==='/profile/edit'){
            revalidatePath(path);
        }

   } catch(err:any)
   {
     throw new Error(`Failed to create/update user: ${err.message}`)
   }
}
//upsert means both updating and inserting
//revalidatePath this is useful where you want to update your cached data without waiting for a revalidation period to expire

export async function fetchUser(userId:string){
    try {
        connectToDB();

        return await User
        .findOne({id:userId})
       // .populate({
       //     path:'communities',
         //   model:Community
       // })
    } catch (error:any) {
        throw new Error(`Failed to fetch user:${error.message}`)
    }
}


export async function fetchUserPosts(userId:string){
    try {
        connectToDB();

        //Find all Threads authored by user with the given userId 
        const threads=await User.findOne({id:userId})
        .populate({
            path:'threads',
            model:Thread,
            populate:{
                path:'children',
                model:Thread,
                populate:{
                    path:'author',
                    model:User,
                    select:'name image id'
                }
            }
        })
        return threads;
    } catch (error:any) {
        throw new Error(`Failed to Fetch user Posts:${error.message}`)
    }
}

export async function fetchUsers({
    userId,
    searchString="",
    pageNumber=1,
    pageSize=20,
    sortBy="desc"
}:{
    userId:string;
    searchString?:string;
    pageNumber?:number;
    pageSize?:number;
    sortBy?:SortOrder;
}){
    try {
        connectToDB();
        //To determine how many users to skip
        const skipAmount=(pageNumber-1)* pageSize;

        const regex=new RegExp(searchString,"i");

        const query:FilterQuery<typeof User>={
            id:{$ne:userId}
        }
        if(searchString.trim()!=='')
        {
            query.$or=[
                {username:{$regex:regex}},
                {name:{$regex:regex}}
            ]
        }

        const sortOptions={createdAt:sortBy};

        const usersQuery=User.find(query).sort(sortOptions).skip(skipAmount).limit(pageSize);
        const totalUserCount=await User.countDocuments(query);

        const users=await usersQuery.exec();

        const isNext=totalUserCount>skipAmount+users.length;
        return {users,isNext};

    } catch (error:any) {
        throw new Error(`Failed to fetch users:${error.message}`)
    }
}

export async function getActivity(userId:string){
    try {
        connectToDB();
        //find all threads created by the user
        const userThreads=await Thread.find({author:userId});

        //collect all the child thread ids (replies) from the 'children' field
       //basically this function cocatenates elements of children Array of multiple threads into a new Array
        const childThreadIds=userThreads.reduce((acc,userThread)=>{
            return acc.concat(userThread.children)
        },[])
        
        const replies=await Thread.find({
            _id:{$ne:childThreadIds},
            author:{$ne:userId}
        }).populate({
            path:'author',
            model:User,
            select:'name image _id'
        })
        return replies;
    } catch (error:any) {
        throw new Error(`Failef to fetch activity:${error.message}`)
    }
}