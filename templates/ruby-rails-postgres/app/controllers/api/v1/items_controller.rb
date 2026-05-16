module Api
  module V1
    class ItemsController < ApplicationController
      def index
        render json: Item.all
      end

      def show
        render json: item
      end

      def create
        item = Item.create!(item_params)
        render json: item, status: :created
      end

      def update
        item.update!(item_params)
        render json: item
      end

      def destroy
        item.destroy!
        head :no_content
      end

      private

      def item
        @item ||= Item.find(params[:id])
      end

      def item_params
        params.require(:item).permit(:name)
      end
    end
  end
end
