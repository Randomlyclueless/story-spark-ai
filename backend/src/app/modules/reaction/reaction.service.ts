import ApiError from "../../../errors/api_error";
import { ITokenPayload } from "../../../interfaces/token";
import { User } from "../user/user.model";
import httpStatus from "http-status";
import { Reaction } from "./reaction.model";
import { Types } from "mongoose";
import { Post } from "../post/post.model";

type ReactionType = "like" | "love" | "laugh" | "angry" | "sad";

const toggleReaction = async (
  postId: string,
  type: ReactionType = "like",
  token: ITokenPayload
) => {
  const { email } = token;

  const user = await User.findOne({ email });
  const user = await User.findOne({ email }).select("_id").lean();

  if (!user) {
    throw new ApiError(httpStatus.BAD_REQUEST, "User not found!");
  }

  const post = await Post.findOne({
    _id: postId,
    isDeleted: { $ne: true },
  });
  }).select("likesCount reactions");

  if (!post) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Post not found!");
  }


  const existingReaction = await Reaction.findOne({
    postId: new Types.ObjectId(postId),
    userId: user._id,
    type: type,
  });

  if (existingReaction) {
    await Reaction.deleteOne({ _id: existingReaction._id });

    const updatedPost = await Post.findOneAndUpdate(
      { _id: postId },
      { $inc: { likesCount: -1 } },
      { new: true }
    );

    if (updatedPost && updatedPost.likesCount < 0) {
      await Post.updateOne(
        { _id: postId },
        { $set: { likesCount: 0 } }
      );
    }

    return {
      message: "Reaction removed",
      likesCount: Math.max(0, updatedPost?.likesCount ?? 0),
    };
  } else {
    const newReaction = await Reaction.create({

  // Check existing reaction
  const existingReaction = await Reaction.findOne({
    postId,
    userId: user._id,
  });

  // Remove reaction if same type clicked again
  if (existingReaction && existingReaction.type === type) {
    await Reaction.findByIdAndDelete(existingReaction._id);

    const likesCount = await Reaction.countDocuments({ postId });

    return {
      message: "Reaction removed successfully",
      likesCount,
    };
  }

  // Update existing reaction
  if (existingReaction) {
    existingReaction.type = type;
    await existingReaction.save();
  } else {
    // Create new reaction
    await Reaction.create({

      postId: new Types.ObjectId(postId),
      userId: user._id,
      type,
    });

    const updatedPost = await Post.findOneAndUpdate(
      { _id: postId },
      { $inc: { likesCount: 1 } },
      { new: true }
    );

    return {
      message: "Reaction added successfully",
      likesCount: updatedPost?.likesCount || 0,
    };


  }

  const likesCount = await Reaction.countDocuments({ postId });

  return {
    message: "Reaction updated successfully",
    likesCount,
  };
};

export const ReactionService = {
  toggleReaction,
};