import { HttpException, Injectable } from '@nestjs/common';
import { PrismaClient, User } from '@prisma/client';
import { RoomType } from '@prisma/client';
import { CreateChannelDto } from './dto/create-channel.dto';

@Injectable()
export class ChatService {
  private prisma: PrismaClient;
  constructor() {
    this.prisma = new PrismaClient();
  }

  async getUser(userName: string) {
    try {
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { login: userName },
        include: { channels: { include: { messages: true } } },
      });
      if (!user) throw new HttpException('User not found', 404);
      return user;
    } catch (err) {
      throw err;
    }
  }

  async getChannel(channelId: string) {
    const channel = await this.prisma.channel.findUniqueOrThrow({
      where: { id: channelId },
      include: {
        messages: true,
        members: true,
        moderators: true,
        owner: true,
      },
    });
    if (!channel) throw new HttpException('Channel not found', 404);
    return channel;
  }

  async getDirectMessage(currentUser: User, username: string) {
    // check the current user and other user
    if (currentUser.displayName === username)
      throw new HttpException('Cannot DM yourself', 400);

    const otherUser = await this.prisma.user.findUnique({
      where: { login: username },
    });

    // check if other user exists
    if (!otherUser) throw new HttpException('User not found', 404);

    // check if dm exists
    const dm = await this.prisma.channel.findFirst({
      where: {
        isDM: true,
        AND: [
          { members: { some: { id: currentUser.id } } },
          { members: { some: { id: otherUser.id } } },
        ],
      },
      include: {
        members: true,
        moderators: true,
        owner: true,
        messages: true,
      },
    });

    if (dm) return dm;

    // create new dm
    const newDM = await this.prisma.channel.create({
      data: {
        name: `${currentUser.displayName} - ${otherUser.displayName}`,
        type: RoomType.PRIVATE,
        isDM: true,
        members: {
          connect: [{ id: currentUser.id }, { id: otherUser.id }],
        },
      },
      include: {
        members: true,
        moderators: true,
        owner: true,
        messages: true,
      },
    });

    return newDM;
  }

  async createChannel(
    name: string,
    type: RoomType,
    password: string,
    user: User,
  ) {
    try {
      const channel = await this.prisma.channel.create({
        data: {
          name,
          type,
          isDM: false,
          password,
          owner: {
            connect: { id: user.id },
          },
          members: {
            connect: { id: user.id },
          },
        },
      });
      return channel;
    } catch (err) {
      throw err;
    }
  }

  async deleteChannel(channelId: string, user: User) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: {
        owner: true,
      },
    });

    // check if channel exists
    if (!channel) {
      throw new HttpException('Channel not found', 404);
    }

    // check if user is owner
    if (channel.owner.id !== user.id) {
      throw new HttpException('You are not the owner', 403);
    }

    // delete channel
    const deletedChannel = await this.prisma.channel.delete({
      where: { id: channelId },
    });

    return deletedChannel;
  }

  async joinChannel(channelId: string, channelPassword: string, user: User) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: {
        type: true,
        members: true,
        password: true,
        bans: {
          where: { id: user.id },
        },
      },
    });

    // check if channel exists or if its a private channel
    if (!channel || channel.type === RoomType.PRIVATE) {
      throw new HttpException('Channel not found', 404);
    }

    // match password if channel is protected
    if (channel.password && channel.password !== channelPassword) {
      throw new HttpException('Invalid password', 401);
    }

    // check if user is banned
    if (channel.bans.length > 0) {
      throw new HttpException('You are banned', 403);
    }

    // check if user is already a member
    const isMember = channel.members.some((member) => member.id === user.id);
    if (isMember) {
      throw new HttpException('You are already a member', 403);
    }

    // add user to channel
    const updatedChannel = await this.prisma.channel.update({
      select: {
        id: true,
        name: true,
        type: true,
        moderators: true,
      },
      where: { id: channelId },
      data: {
        members: {
          connect: { id: user.id },
        },
      },
    });

    return updatedChannel;
  }

  async leaveChannel(channelId: string, user: User) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: {
        type: true,
        members: true,
        owner: true,
      },
    });

    // check if channel exists
    if (!channel) {
      throw new HttpException('Channel not found', 404);
    }

    // check if user is owner
    if (channel.owner.id === user.id) {
      throw new HttpException('You are the owner', 403);
    }

    // check if user is a member
    const isMember = channel.members.some((member) => member.id === user.id);
    if (!isMember) {
      throw new HttpException('You are not a member', 403);
    }

    // remove user from channel
    const updatedChannel = await this.prisma.channel.update({
      select: {
        id: true,
        name: true,
        type: true,
      },
      where: { id: channelId },
      data: {
        members: {
          disconnect: { id: user.id },
        },
      },
    });

    return updatedChannel;
  }

  async updateChannel(
    channelId: string,
    user: User,
    createChannelDto: CreateChannelDto,
  ) {
    const { name, type, password } = createChannelDto;

    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: {
        owner: true,
      },
    });

    // check if channel exists
    if (!channel) {
      throw new HttpException('Channel not found', 404);
    }

    // check if user is owner
    if (channel.owner.id !== user.id) {
      throw new HttpException('You are not the owner', 403);
    }

    //check if there is a password if channel is protected
    if (type === RoomType.PROTECTED && !password) {
      throw new HttpException('Password required', 400);
    }

    // update channel
    const updatedChannel = await this.prisma.channel.update({
      select: {
        id: true,
        name: true,
        type: true,
        moderators: true,
      },
      where: { id: channelId },
      data: {
        name,
        type,
        password,
      },
    });

    return updatedChannel;
  }

  async addModerator(channelId: string, user: User, moderatorId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: {
        owner: true,
        moderators: true,
      },
    });

    // check if channel exists
    if (!channel) {
      throw new HttpException('Channel not found', 404);
    }

    // check if user is owner
    if (channel.owner.id !== user.id) {
      throw new HttpException('You are not the owner', 403);
    }

    // check if user is member
    const isMember = channel.moderators.some(
      (moderator) => moderator.id === moderatorId,
    );
    if (!isMember) {
      throw new HttpException('User is not a member', 403);
    }

    // check if user is already a moderator
    const isModerator = channel.moderators.some(
      (moderator) => moderator.id === moderatorId,
    );
    if (isModerator) {
      throw new HttpException('User is already a moderator', 403);
    }

    // add moderator
    const updatedChannel = await this.prisma.channel.update({
      select: {
        id: true,
        name: true,
        type: true,
        moderators: true,
      },
      where: { id: channelId },
      data: {
        moderators: {
          connect: { id: moderatorId },
        },
      },
    });

    return updatedChannel;
  }

  async removeModerator(channelId: string, user: User, moderatorId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: {
        owner: true,
        moderators: true,
      },
    });

    // check if channel exists
    if (!channel) {
      throw new HttpException('Channel not found', 404);
    }

    // check if user is owner
    if (channel.owner.id !== user.id) {
      throw new HttpException('You are not the owner', 403);
    }

    // check if user is moderator
    const isModerator = channel.moderators.some(
      (moderator) => moderator.id === moderatorId,
    );
    if (!isModerator) {
      throw new HttpException('User is not a moderator', 403);
    }

    // remove moderator
    const updatedChannel = await this.prisma.channel.update({
      select: {
        id: true,
        name: true,
        type: true,
        moderators: true,
      },
      where: { id: channelId },
      data: {
        moderators: {
          disconnect: { id: moderatorId },
        },
      },
    });

    return updatedChannel;
  }

  async banUser(channelId: string, user: User, userId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: {
        owner: true,
        bans: true,
        moderators: true,
      },
    });

    // check if channel exists
    if (!channel) {
      throw new HttpException('Channel not found', 404);
    }

    // check if user is owner or moderator
    if (
      channel.owner.id !== user.id &&
      !channel.moderators.some((moderator) => moderator.id === user.id)
    ) {
      throw new HttpException('You are not the owner or moderator', 403);
    }

    // check if user is already banned
    const isBanned = channel.bans.some((ban) => ban.id === userId);
    if (isBanned) {
      throw new HttpException('User is already banned', 403);
    }

    // ban user
    const updatedChannel = await this.prisma.channel.update({
      select: {
        id: true,
        name: true,
        type: true,
        bans: true,
      },
      where: { id: channelId },
      data: {
        bans: {
          connect: { id: userId },
        },
      },
    });

    return updatedChannel;
  }

  async unbanUser(channelId: string, user: User, userId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: {
        owner: true,
        bans: true,
        moderators: true,
      },
    });

    // check if channel exists
    if (!channel) {
      throw new HttpException('Channel not found', 404);
    }

    // check if user is owner or moderator
    if (
      channel.owner.id !== user.id &&
      !channel.moderators.some((moderator) => moderator.id === user.id)
    ) {
      throw new HttpException('You are not the owner or moderator', 403);
    }

    // check if user is banned
    const isBanned = channel.bans.some((ban) => ban.id === userId);
    if (!isBanned) {
      throw new HttpException('User is not banned', 403);
    }

    // unban user
    const updatedChannel = await this.prisma.channel.update({
      select: {
        id: true,
        name: true,
        type: true,
        bans: true,
      },
      where: { id: channelId },
      data: {
        bans: {
          disconnect: { id: userId },
        },
      },
    });

    return updatedChannel;
  }

  async muteUser(channelId: string, user: User, userId: string, time: number) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: {
        owner: true,
        mutes: true,
        moderators: true,
      },
    });

    // check if channel exists
    if (!channel) {
      throw new HttpException('Channel not found', 404);
    }

    // check if user is owner or moderator
    if (
      channel.owner.id !== user.id &&
      !channel.moderators.some((moderator) => moderator.id === user.id)
    ) {
      throw new HttpException('You are not the owner or moderator', 403);
    }

    // check if user is already muted
    const isMuted = channel.mutes.some((mute) => mute.id === userId);
    if (isMuted) {
      throw new HttpException('User is already muted', 403);
    }

    // mute user
    const updatedChannel = await this.prisma.channel.update({
      select: {
        id: true,
        name: true,
        type: true,
        mutes: true,
      },
      where: { id: channelId },
      data: {
        mutes: {
          create: { userId, muteDuration: time },
        },
      },
    });

    return updatedChannel;
  }

  async unmuteUser(channelId: string, user: User, userId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: {
        owner: true,
        mutes: true,
        moderators: true,
      },
    });

    // check if channel exists
    if (!channel) {
      throw new HttpException('Channel not found', 404);
    }

    // check if user is owner or moderator
    if (
      channel.owner.id !== user.id &&
      !channel.moderators.some((moderator) => moderator.id === user.id)
    ) {
      throw new HttpException('You are not the owner or moderator', 403);
    }

    // check if user is muted
    const isMuted = channel.mutes.some((mute) => mute.id === userId);
    if (!isMuted) {
      throw new HttpException('User is not muted', 403);
    }

    // unmute user
    const updatedChannel = await this.prisma.channel.update({
      select: {
        id: true,
        name: true,
        type: true,
        mutes: true,
      },
      where: { id: channelId },
      data: {
        mutes: {
          delete: { id: userId },
        },
      },
    });

    return updatedChannel;
  }
}
